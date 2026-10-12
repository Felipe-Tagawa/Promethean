// Cópia em JavaScript do motor por ticks do servidor (engine/SimulationEngine.java) e dos três escalonadores.
// A tela só a usa quando há uma ameaça ativa (threats.js): o servidor não conhece ameaças, então o replanejamento
// é feito aqui. Sem ameaça, ela gera os mesmos eventos do servidor, e main.js confere isso antes de liberar o seletor.

const MAX_TICKS = 1000;
const IN_SYSTEM = ['READY', 'RUNNING'];

// ---------- escalonadores: as mesmas regras de scheduler/*.java ----------

class Fcfs {
    constructor() {
        this.queue = [];
    }

    add(ship) {
        this.queue.push(ship);
    }

    hasReady() {
        return this.queue.length > 0;
    }

    selectNext() {
        return this.queue.shift();
    }

    shouldPreempt() {
        return false;
    }

    onTick() {
        // sem aging
    }

    remove(ship) {
        this.queue = this.queue.filter(other => other !== ship);
    }
}

class Sjf extends Fcfs {
    /** Menor burst; no empate, quem chegou antes. */
    selectNext() {
        let min = null;
        for (const ship of this.queue) {
            if (min === null || ship.burstTime < min.burstTime
                || (ship.burstTime === min.burstTime && ship.arrivalTime < min.arrivalTime)) {
                min = ship;
            }
        }
        this.remove(min);
        return min;
    }
}

class Priority extends Fcfs {
    constructor(agingInterval = 5, agingBoost = 1) {
        super();
        this.agingInterval = agingInterval;
        this.agingBoost = agingBoost;
    }

    /** Menor número de prioridade; no empate, quem chegou antes. */
    selectNext() {
        let best = this.queue[0];
        for (const ship of this.queue.slice(1)) {
            if (ship.currentPriority < best.currentPriority
                || (ship.currentPriority === best.currentPriority && ship.arrivalTime < best.arrivalTime)) {
                best = ship;
            }
        }
        this.remove(best);
        return best;
    }

    shouldPreempt(running) {
        return this.queue.some(ship => ship.currentPriority < running.currentPriority);
    }

    /** Aging: a cada `agingInterval` ticks na fila, a nave sobe `agingBoost` níveis. */
    onTick() {
        for (const ship of this.queue) {
            if (ship.timeInState > 0 && ship.timeInState % this.agingInterval === 0) {
                // No servidor o piso é 0. Uma ameaça pode pôr a nave abaixo disso, e o aging não a faz voltar
                ship.currentPriority = Math.min(ship.currentPriority, Math.max(0, ship.currentPriority - this.agingBoost));
            }
        }
    }
}

const SCHEDULERS = {fcfs: Fcfs, sjf: Sjf, priority: Priority};

/** Algoritmos que esta cópia sabe simular, pelas chaves do catálogo do servidor. */
export const SUPPORTED = Object.keys(SCHEDULERS);

// ---------- motor ----------

/**
 * Roda uma simulação inteira e devolve a gravação no formato da seção 3.2 do contrato.
 * @param algorithm chave do algoritmo (fcfs, sjf ou priority)
 * @param name nome do algoritmo, copiado para a gravação
 * @param spacecrafts carga: [{id, arrivalTime, burstTime, basePriority}]
 * @param ports ids das portas
 * @param threat opcional: ameaça de threats.js, aplicada durante a simulação
 */
export function simulate({algorithm, name, spacecrafts, ports: portIds, threat = null}) {
    const Scheduler = SCHEDULERS[algorithm];
    if (!Scheduler) throw new Error(`O simulador da tela não conhece o algoritmo "${algorithm}".`);
    const scheduler = new Scheduler();

    const ships = spacecrafts.map(s => ({
        id: String(s.id),
        arrivalTime: Number(s.arrivalTime),
        burstTime: Number(s.burstTime),
        remaining: Number(s.burstTime),
        basePriority: Number(s.basePriority),
        currentPriority: Number(s.basePriority),
        role: Number(s.basePriority), // prioridade da carga: é por ela que as ameaças escolhem o alvo
        waitingTime: 0,
        startTime: -1,
        finishTime: -1,
        timeInState: 0,
        state: 'NEW',
    }));
    const levels = [...new Set(ships.map(s => s.role))].sort((a, b) => a - b);
    for (const ship of ships) ship.rank = levels.indexOf(ship.role);

    const ports = portIds.map(id => ({id: String(id), current: null, downUntil: 0}));
    const events = [];
    const pending = (threat?.actions ?? []).map(action => ({...action, struck: new Set()}));
    let revivals = []; // naves destruídas que vão voltar: {ship, tick, text}
    let clock = 0;
    let contextSwitches = 0;

    const setState = (ship, state) => {
        ship.state = state;
        ship.timeInState = 0;
    };
    const emit = (type, ship, port) => events.push({tick: clock, type, spaceCraftId: ship.id, portId: port ? port.id : null});
    const isDown = port => clock < port.downUntil;

    function admitArrivals() {
        for (const ship of ships) {
            if (ship.arrivalTime === clock && ship.state === 'NEW') {
                setState(ship, 'READY');
                scheduler.add(ship);
                emit('ARRIVAL', ship, null);
            }
        }
    }

    function handleRunning() {
        for (const port of ports) {
            const ship = port.current;
            if (!ship) continue;
            if (ship.remaining === 0) {
                setState(ship, 'FINISHED');
                ship.finishTime = clock;
                port.current = null;
                emit('FINISH', ship, port);
            } else if (!isDown(port) && scheduler.shouldPreempt(ship)) {
                setState(ship, 'READY');
                ship.currentPriority = ship.basePriority;
                port.current = null;
                contextSwitches++;
                scheduler.add(ship);
                emit('PREEMPT', ship, port);
            }
        }
    }

    function dispatchIdlePorts() {
        for (const port of ports) {
            if (!port.current && !isDown(port) && scheduler.hasReady()) {
                const ship = scheduler.selectNext();
                if (ship.startTime === -1) ship.startTime = clock;
                port.current = ship;
                setState(ship, 'RUNNING');
                emit('DISPATCH', ship, port);
            }
        }
    }

    function advanceTime() {
        for (const ship of ships) {
            if (ship.state === 'READY') {
                ship.waitingTime++;
                ship.timeInState++;
            }
        }
        // Com a porta interditada, a nave atracada fica parada: não executa nem perde o lugar
        for (const port of ports) {
            if (port.current && !isDown(port)) port.current.remaining--;
        }
        clock++;
    }

    // ---------- ameaças: esta parte não existe no servidor ----------

    /** Naves que a ameaça pode atingir agora: as que estão na órbita ou atracadas e ainda têm o que executar. */
    function targetsOf(action) {
        const present = ships.filter(s => IN_SYSTEM.includes(s.state) && s.remaining > 0 && !action.struck.has(s));
        const by = (pick, tieBreak) => present.length === 0 ? [] : [present.reduce((best, s) =>
            pick(s) > pick(best) || (pick(s) === pick(best) && tieBreak(s, best)) ? s : best)];
        const selector = action.target;

        if (selector === 'running') return present.filter(s => s.state === 'RUNNING').slice(0, 1);
        if (selector === 'firstReady') return scheduler.queue.filter(s => present.includes(s)).slice(0, 1);
        if (selector === 'allReady') return scheduler.queue.filter(s => present.includes(s));
        if (selector === 'leastUrgent') return by(s => s.role, (s, best) => s.arrivalTime > best.arrivalTime);
        if (selector === 'mostUrgent') return by(s => -s.role, (s, best) => s.arrivalTime < best.arrivalTime);
        if (selector === 'longestBurst') return by(s => s.burstTime, (s, best) => s.arrivalTime < best.arrivalTime);
        if (typeof selector?.rank === 'number') return present.filter(s => s.rank === selector.rank).slice(0, 1);
        return [];
    }

    function strike(action, ship) {
        const event = {tick: clock, type: 'THREAT', spaceCraftId: ship.id, portId: null, effects: []};
        for (const effect of action.effects) {
            if (effect.kind === 'priority') {
                // Passa na frente de todas: um nível acima da mais urgente que existir no momento
                const top = Math.min(...ships.map(s => s.basePriority)) - 1;
                ship.basePriority = top;
                ship.currentPriority = top;
                event.effects.push({kind: 'priority', priority: top});
            } else if (effect.kind === 'burst') {
                ship.burstTime += effect.amount;
                ship.remaining += effect.amount;
                event.effects.push({kind: 'burst', amount: effect.amount, burstTime: ship.burstTime});
            } else if (effect.kind === 'destroy') {
                const port = ports.find(p => p.current === ship);
                if (port) {
                    port.current = null;
                    event.portId = port.id;
                } else {
                    scheduler.remove(ship);
                }
                setState(ship, 'KILLED');
                event.effects.push({kind: 'destroy', style: effect.style ?? 'explode'});
                if (effect.revive) {
                    revivals.push({ship, tick: clock + effect.revive, text: action.reviveText ?? '{nave} voltou à órbita'});
                }
            }
        }
        event.text = action.text.replace('{nave}', ship.id);
        events.push(event);
    }

    function closePorts(action, ticks) {
        const until = clock + ticks;
        for (const port of ports) port.downUntil = Math.max(port.downUntil, until);
        events.push({
            tick: clock, type: 'THREAT', spaceCraftId: null, portId: ports[0].id,
            effects: [{kind: 'port-down', until}],
            text: action.text.replace('{porta}', ports.map(p => p.id).join(', ')),
        });
    }

    function applyThreat() {
        // As portas reabrem antes do despacho deste tick
        for (const port of ports) {
            if (port.downUntil === clock && clock > 0) {
                events.push({
                    tick: clock, type: 'THREAT', spaceCraftId: null, portId: port.id,
                    effects: [{kind: 'port-up'}], text: `A porta ${port.id} voltou a operar`,
                });
            }
        }

        // Reviver: a nave volta para o fim da fila como se chegasse agora, sem nada do que já tinha executado
        for (const revival of revivals.filter(r => r.tick === clock)) {
            const ship = revival.ship;
            ship.remaining = ship.burstTime;
            ship.currentPriority = ship.basePriority;
            setState(ship, 'READY');
            scheduler.add(ship);
            events.push({
                tick: clock, type: 'THREAT', spaceCraftId: ship.id, portId: null,
                effects: [{kind: 'revive'}], text: revival.text.replace('{nave}', ship.id),
            });
        }
        revivals = revivals.filter(r => r.tick > clock);

        for (const action of pending) {
            if (action.done || clock < action.tick) continue;
            const repeats = Boolean(action.every);
            if (repeats && (clock - action.tick) % action.every !== 0) continue;

            const closing = action.effects.find(effect => effect.kind === 'port');
            if (closing) {
                closePorts(action, closing.ticks);
                action.done = true;
                continue;
            }

            // Sem alvo neste tick, a ação de uma vez só espera o próximo; a que se repete pula a vez
            const targets = targetsOf(action);
            for (const ship of targets) {
                action.struck.add(ship);
                strike(action, ship);
            }
            if (targets.length > 0 && !repeats) action.done = true;
        }
    }

    // ---------- laço principal: a mesma ordem do servidor, com as ameaças logo depois das chegadas ----------

    while (ships.some(s => s.state !== 'FINISHED' && s.state !== 'KILLED') || revivals.length > 0) {
        if (clock > MAX_TICKS) {
            throw new Error(`A simulação passou de ${MAX_TICKS} ticks: alguma nave nunca termina.`);
        }
        admitArrivals();
        if (threat) applyThreat();
        scheduler.onTick();
        handleRunning();
        dispatchIdlePorts();
        advanceTime();
    }

    // As médias consideram só as naves que terminaram; as destruídas entram no contador `lost`
    const finished = ships.filter(s => s.state === 'FINISHED');
    const average = pick => finished.length === 0 ? 0 : finished.reduce((sum, s) => sum + pick(s), 0) / finished.length;
    const totalTime = finished.length === 0 ? clock : Math.max(...finished.map(s => s.finishTime));

    return {
        version: 1,
        algorithm: name,
        ports: ports.map(p => p.id),
        spacecrafts: spacecrafts.map(s => ({id: s.id, arrivalTime: s.arrivalTime, burstTime: s.burstTime, basePriority: s.basePriority})),
        events,
        metrics: {
            algorithm: name,
            avgWaitingTime: average(s => s.waitingTime),
            avgTurnaroundTime: average(s => s.finishTime - s.arrivalTime),
            avgResponseTime: average(s => s.startTime - s.arrivalTime),
            throughput: totalTime > 0 ? finished.length / totalTime : 0,
            contextSwitches,
            lost: ships.length - finished.length,
        },
        threat: threat ? {key: threat.key, name: threat.name, visual: threat.visual} : null,
    };
}

/** Diz se duas listas de eventos são a mesma simulação (mesmos tick, tipo, nave e porta, na mesma ordem). */
export function sameEvents(a, b) {
    const key = e => `${e.tick}|${e.type}|${e.spaceCraftId}|${e.portId ?? ''}`;
    return a.length === b.length && a.every((event, index) => key(event) === key(b[index]));
}
