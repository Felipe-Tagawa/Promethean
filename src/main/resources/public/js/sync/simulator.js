// Simulador do modo demonstração: gera os eventos de sincronismo para qualquer quantidade de naves e braços,
// no formato da seção 4 do contrato. Não usa threads: é uma conta determinística, que dá sempre o mesmo resultado.
// As regras são as mesmas que o backend deve seguir (seção 4.5 do contrato). Com o servidor ligado, quem manda é ele.

export const LIMITS = {
    ships: {min: 1, max: 6},
    arms: {race: {min: 1, max: 4}, deadlock: {min: 2, max: 4}},
};
export const DEFAULT_COUNTS = {race: {ships: 3, arms: 1}, deadlock: {ships: 2, arms: 2}};

const STEP = 300;           // intervalo entre as chegadas das naves
const ARRIVAL_WINDOW = 900; // na disputa, todas as naves chegam dentro desse tempo, antes de a primeira sair
const GAP = 600;            // pausa entre pegar o primeiro braço e pedir o segundo
const WORK = 1200;          // tempo de uso dos braços
const DETECT_DELAY = 1000;  // tempo que o detector leva para notar a estação parada
const ABORT_DELAY = 800;    // tempo entre detectar o deadlock e recuar a vítima
const BACKOFF = 1500;       // espera da nave que recuou antes de tentar de novo
const TIMEOUT_BASE = 1500;  // paciência da nave menos paciente
const TIMEOUT_STEP = 2500;  // cada nave anterior no anel espera esse tanto a mais
const CARGO_PER_SHIP = 100;
const CARGO_LOST_PER_SHIP_IN_COLLISION = 22.6;
const MAX_STEPS = 5000;     // trava de segurança contra laço infinito

const POOL_ID = 'ROBOTIC_ARMS';
const ARM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function clamp(value, {min, max}) {
    return Math.min(max, Math.max(min, Math.round(Number(value) || min)));
}

/** Ajusta as quantidades aos limites do cenário. */
export function normalize(config) {
    const scenario = config.scenario === 'deadlock' ? 'deadlock' : 'race';
    return {
        scenario,
        sync: Boolean(config.sync),
        recovery: ['detection', 'timeout'].includes(config.recovery) ? config.recovery : 'none',
        ships: clamp(config.ships ?? DEFAULT_COUNTS[scenario].ships, LIMITS.ships),
        arms: clamp(config.arms ?? DEFAULT_COUNTS[scenario].arms, LIMITS.arms[scenario]),
    };
}

/** Agenda de ações futuras, executadas em ordem de tempo; no empate, na ordem em que foram agendadas. */
class Agenda {
    constructor() {
        this.items = [];
        this.counter = 0;
    }

    at(time, action) {
        this.items.push({time, order: this.counter++, action});
    }

    next() {
        if (this.items.length === 0) return null;
        let best = 0;
        for (let i = 1; i < this.items.length; i++) {
            const a = this.items[i];
            const b = this.items[best];
            if (a.time < b.time || (a.time === b.time && a.order < b.order)) best = i;
        }
        return this.items.splice(best, 1)[0];
    }
}

/** Guarda os eventos. Os que acontecem no mesmo instante saem com 1 ms de diferença, na ordem de emissão. */
class Recorder {
    constructor() {
        this.events = [];
        this.offsets = new Map();
        this.last = 0;
    }

    emit(time, type, fields = {}) {
        const offset = this.offsets.get(time) ?? 0;
        this.offsets.set(time, offset + 1);
        this.events.push({timeMs: time + offset, type, ...fields});
        this.last = Math.max(this.last, time);
    }

    finish() {
        this.events.sort((a, b) => a.timeMs - b.timeMs);
        return this.events.map((event, seq) => ({seq, ...event}));
    }
}

/**
 * @param config {scenario: 'race' | 'deadlock', sync, recovery: 'none' | 'detection' | 'timeout', ships, arms}
 * @returns lista de eventos, de SYNC_START a SYNC_END
 */
export function simulate(config) {
    const normal = normalize(config);
    return normal.scenario === 'race' ? simulateRace(normal) : simulateRing(normal);
}

/**
 * Disputa: os braços formam um conjunto (um recurso com capacidade = número de braços).
 * Com sincronismo é um semáforo contador com fila por ordem de chegada; sem ele, toda nave entra direto.
 */
function simulateRace({sync, ships: shipCount, arms: armCount}) {
    const out = new Recorder();
    const agenda = new Agenda();
    const ids = Array.from({length: shipCount}, (_, i) => `N${i + 1}`);
    const holders = [];
    const queue = [];
    let collisions = 0;
    let lost = 0;

    out.emit(0, 'SYNC_START', {
        scenario: 'RACE', sync, recovery: 'NONE',
        spacecrafts: ids,
        resources: [{id: POOL_ID, capacity: armCount}],
    });

    const acquire = (time, id) => {
        holders.push(id);
        out.emit(time, 'ACQUIRE', {spaceCraftId: id, resourceId: POOL_ID});
        agenda.at(time + WORK, release(id));
    };
    const release = id => time => {
        holders.splice(holders.indexOf(id), 1);
        out.emit(time, 'RELEASE', {spaceCraftId: id, resourceId: POOL_ID});
        out.emit(time, 'DONE', {spaceCraftId: id});
        if (sync && queue.length > 0) acquire(time, queue.shift());
    };

    // Com muitas naves as chegadas ficam mais próximas, para todas disputarem os braços ao mesmo tempo
    const step = Math.min(STEP, Math.round(ARRIVAL_WINDOW / Math.max(1, shipCount - 1)));
    ids.forEach((id, index) => agenda.at(STEP + step * index, time => {
        out.emit(time, 'REQUEST', {spaceCraftId: id, resourceId: POOL_ID});
        if (sync && holders.length >= armCount) {
            queue.push(id);
            return;
        }
        acquire(time, id);
        if (holders.length > armCount) {
            collisions++;
            lost += CARGO_LOST_PER_SHIP_IN_COLLISION * holders.length;
            out.emit(time, 'COLLISION', {resourceId: POOL_ID, spaceCraftIds: [...holders]});
        }
    }));

    for (let item = agenda.next(); item; item = agenda.next()) item.action(item.time);

    const expected = CARGO_PER_SHIP * shipCount;
    out.emit(out.last + 100, 'SYNC_END', {
        reason: 'COMPLETED', collisions,
        cargoExpected: expected,
        cargoActual: Math.max(0, expected - Math.round(lost)),
    });
    return out.finish();
}

/**
 * Deadlock: anel de naves, como no jantar dos filósofos. Cada braço é um recurso de capacidade 1.
 * A nave i pega o braço i e depois pede o braço i + 1; a última pede o primeiro e fecha o ciclo.
 */
function simulateRing({sync, recovery, ships: shipCount, arms: armCount}) {
    const out = new Recorder();
    const agenda = new Agenda();
    const arms = ARM_LETTERS.slice(0, armCount).map(letter => ({id: `ROBOTIC_ARM_${letter}`, holders: [], queue: []}));
    const ships = Array.from({length: shipCount}, (_, index) => ({
        id: `N${index + 1}`,
        index,
        first: arms[index % armCount],
        second: arms[(index + 1) % armCount],
        holds: [],
        wait: null,   // {arm, stage, ticket} enquanto espera
        attempt: 0,
        done: false,
    }));
    const secondPhase = STEP * shipCount + GAP; // os segundos pedidos só começam depois de todas pegarem o primeiro braço
    let collisions = 0;
    let tickets = 0;

    out.emit(0, 'SYNC_START', {
        scenario: 'DEADLOCK', sync, recovery: recovery.toUpperCase(),
        spacecrafts: ships.map(s => s.id),
        resources: arms.map(a => ({id: a.id, capacity: 1})),
    });

    const request = (ship, stage) => time => {
        const arm = stage === 'first' ? ship.first : ship.second;
        out.emit(time, 'REQUEST', {spaceCraftId: ship.id, resourceId: arm.id});

        if (!sync) {
            grant(time, ship, arm, stage);
            if (arm.holders.length > 1) {
                collisions++;
                out.emit(time, 'COLLISION', {resourceId: arm.id, spaceCraftIds: arm.holders.map(s => s.id)});
            }
            return;
        }
        if (arm.holders.length === 0 && arm.queue.length === 0) {
            grant(time, ship, arm, stage);
            return;
        }
        const ticket = ++tickets;
        ship.wait = {arm, stage, ticket};
        arm.queue.push(ship);
        if (recovery === 'timeout' && stage === 'second') {
            // Cada nave tem uma paciência diferente; se todas desistissem juntas, voltariam a travar juntas
            const patience = (TIMEOUT_BASE + TIMEOUT_STEP * (armCount - 1 - ship.index % armCount)) * (ship.attempt + 1);
            agenda.at(time + patience, now => {
                if (ship.wait?.ticket !== ticket) return; // já conseguiu o braço
                out.emit(now, 'TIMEOUT', {spaceCraftId: ship.id, resourceId: arm.id});
                retreat(now, ship);
            });
        }
    };

    const grant = (time, ship, arm, stage) => {
        ship.wait = null;
        ship.holds.push(arm);
        arm.holders.push(ship);
        out.emit(time, 'ACQUIRE', {spaceCraftId: ship.id, resourceId: arm.id});
        if (stage === 'first') {
            const start = ship.attempt === 0 ? secondPhase + STEP * ship.index : 0;
            agenda.at(Math.max(time + GAP, start), request(ship, 'second'));
        } else {
            agenda.at(time + WORK, finish(ship));
        }
    };

    const letGo = (time, ship, arm) => {
        ship.holds.splice(ship.holds.indexOf(arm), 1);
        arm.holders.splice(arm.holders.indexOf(ship), 1);
        out.emit(time, 'RELEASE', {spaceCraftId: ship.id, resourceId: arm.id});
    };

    /**
     * Passa o braço para a próxima nave da fila. Tem preferência quem já segura outro braço, porque é a nave
     * que consegue terminar; entre as demais vale a ordem de chegada. Sem essa preferência, com mais naves
     * que braços as recém-chegadas tomariam o braço liberado e ninguém completaria o par.
     */
    const handOver = (time, arm) => {
        if (!sync || arm.holders.length > 0 || arm.queue.length === 0) return;
        const index = Math.max(0, arm.queue.findIndex(ship => ship.wait.stage === 'second'));
        const next = arm.queue.splice(index, 1)[0];
        grant(time, next, arm, next.wait.stage);
    };

    const finish = ship => time => {
        const released = [...ship.holds].reverse(); // solta primeiro o último que pegou
        released.forEach(arm => letGo(time, ship, arm));
        ship.done = true;
        out.emit(time, 'DONE', {spaceCraftId: ship.id});
        released.forEach(arm => handOver(time, arm));
    };

    /** A nave desiste do que espera, solta o que tem e tenta tudo de novo mais tarde. */
    const retreat = (time, ship) => {
        const waited = ship.wait.arm;
        waited.queue.splice(waited.queue.indexOf(ship), 1);
        ship.wait = null;
        const released = [...ship.holds].reverse();
        released.forEach(arm => letGo(time, ship, arm));
        released.forEach(arm => handOver(time, arm));
        ship.attempt++;
        agenda.at(time + BACKOFF, request(ship, 'first'));
    };

    /** Naves que seguram um braço e esperam outro, em ciclo. */
    const findCycle = () => {
        for (const start of ships) {
            const path = [];
            let ship = start;
            while (ship && ship.wait && ship.holds.length > 0 && !path.includes(ship)) {
                path.push(ship);
                ship = ship.wait.arm.holders[0];
            }
            if (ship && path.includes(ship)) {
                return path.slice(path.indexOf(ship)).sort((a, b) => a.index - b.index);
            }
        }
        return [];
    };

    ships.forEach(ship => agenda.at(STEP * (ship.index + 1), request(ship, 'first')));

    let reason = 'COMPLETED';
    for (let steps = 0; steps < MAX_STEPS; steps++) {
        const item = agenda.next();
        if (item) {
            item.action(item.time);
            continue;
        }
        // Nada mais vai acontecer sozinho: ou todas terminaram, ou a estação travou
        const cycle = findCycle();
        if (cycle.length === 0) break;

        const detected = out.last + DETECT_DELAY;
        out.emit(detected, 'DEADLOCK_DETECTED', {spaceCraftIds: cycle.map(s => s.id)});
        if (recovery !== 'detection') {
            reason = 'DEADLOCKED';
            break;
        }
        const victim = cycle[cycle.length - 1]; // a de maior número no ciclo
        agenda.at(detected + ABORT_DELAY, time => {
            out.emit(time, 'VICTIM_ABORTED', {spaceCraftId: victim.id});
            retreat(time, victim);
        });
    }

    out.emit(out.last + 100, 'SYNC_END', {reason, collisions});
    return out.finish();
}
