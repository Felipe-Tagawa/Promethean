// Reconstrói o estado da estação em cada tick a partir da gravação (seção 3.4 do contrato).
// O front não recebe o estado pronto: ele aplica os eventos em ordem. É isso que permite voltar no tempo.
// Os eventos THREAT só existem nas gravações do motor da tela (engine.js), quando há uma ameaça ativa.

import {PALETTE} from './palette.js';

/**
 * @param recording gravação devolvida pelo servidor (ou um arquivo de exemplo)
 * @returns naves, portas, um quadro por tick, os trechos do Gantt, os tempos de cada nave e qual é a mais urgente
 */
export function buildTimeline(recording) {
    if (!recording || !Array.isArray(recording.spacecrafts) || !Array.isArray(recording.events)) {
        throw new Error('A gravação não tem as listas "spacecrafts" e "events".');
    }

    const ships = recording.spacecrafts.map((s, index) => ({
        id: String(s.id),
        arrivalTime: Number(s.arrivalTime),
        burstTime: Number(s.burstTime),
        basePriority: Number(s.basePriority),
        color: PALETTE[index % PALETTE.length],
    }));
    const byId = new Map(ships.map(s => [s.id, s]));

    // Nível de urgência de cada nave: 0 é o mais urgente. Vale o mesmo critério do escalonador de prioridade,
    // em que o número menor passa na frente. Sem prioridade na gravação, o nível fica null.
    const levels = [...new Set(ships.map(s => s.basePriority).filter(Number.isFinite))].sort((a, b) => a - b);
    for (const ship of ships) {
        ship.priorityRank = Number.isFinite(ship.basePriority) ? levels.indexOf(ship.basePriority) : null;
    }
    // A nave mais urgente só existe se as prioridades forem diferentes entre si
    const urgentId = levels.length > 1 ? ships.find(s => s.priorityRank === 0).id : null;

    // Um evento de porta interditada não cita nave nenhuma
    const events = recording.events.map(e => ({
        ...e,
        tick: Number(e.tick),
        spaceCraftId: e.spaceCraftId == null ? null : String(e.spaceCraftId),
    }));
    for (const e of events) {
        if (e.spaceCraftId !== null && !byId.has(e.spaceCraftId)) {
            throw new Error(`O evento ${e.type} do tick ${e.tick} cita a nave "${e.spaceCraftId}", que não está na carga.`);
        }
    }

    let ports = Array.isArray(recording.ports) ? recording.ports.map(String) : [];
    if (ports.length === 0) {
        ports = [...new Set(events.filter(e => e.portId != null).map(e => String(e.portId)))];
    }

    const totalTicks = events.reduce((max, e) => Math.max(max, e.tick), 0);

    // Estado que vai sendo alterado tick a tick
    // Mudam só com ameaça: burst pode crescer, struck marca a nave atingida e boosted a que passou na frente de todas
    const live = new Map(ships.map(s => [s.id, {
        state: 'NEW', portId: null, executed: 0, waiting: 0, burst: s.burstTime, struck: false, boosted: false, exit: null,
    }]));
    const readyOrder = []; // ordem em que as naves entraram em READY
    const open = new Map(); // nave -> trecho do Gantt ainda aberto
    const segments = [];
    const outages = []; // intervalos em que as portas ficaram interditadas
    const results = new Map(ships.map(s => [s.id, {start: null, finish: null, killed: null}]));
    const frames = [];
    let preemptions = 0;
    let portsDown = false;
    let cursor = 0;

    const closeSegment = (id, tick) => {
        const segment = open.get(id);
        if (segment) {
            segment.end = tick;
            open.delete(id);
        }
    };

    for (let tick = 0; tick <= totalTicks; tick++) {
        const now = [];
        while (cursor < events.length && events[cursor].tick <= tick) {
            const e = events[cursor++];
            const ship = live.get(e.spaceCraftId);
            now.push(e);

            switch (e.type) {
                case 'ARRIVAL':
                    ship.state = 'READY';
                    readyOrder.push(e.spaceCraftId);
                    break;
                case 'DISPATCH': {
                    ship.state = 'RUNNING';
                    ship.portId = String(e.portId);
                    remove(readyOrder, e.spaceCraftId);
                    const result = results.get(e.spaceCraftId);
                    if (result.start === null) result.start = e.tick;
                    const segment = {spaceCraftId: e.spaceCraftId, portId: ship.portId, start: e.tick, end: null};
                    segments.push(segment);
                    open.set(e.spaceCraftId, segment);
                    break;
                }
                case 'PREEMPT':
                    ship.state = 'READY';
                    ship.portId = null;
                    readyOrder.push(e.spaceCraftId);
                    closeSegment(e.spaceCraftId, e.tick);
                    preemptions++;
                    break;
                case 'FINISH':
                    ship.state = 'FINISHED';
                    ship.portId = null;
                    remove(readyOrder, e.spaceCraftId);
                    closeSegment(e.spaceCraftId, e.tick);
                    results.get(e.spaceCraftId).finish = e.tick;
                    break;
                case 'THREAT':
                    for (const effect of e.effects ?? []) {
                        if (effect.kind === 'priority') {
                            ship.struck = true;
                            ship.boosted = true;
                        } else if (effect.kind === 'burst') {
                            ship.struck = true;
                            ship.burst += Number(effect.amount);
                        } else if (effect.kind === 'destroy') {
                            ship.state = 'KILLED';
                            ship.portId = null;
                            ship.exit = effect.style;
                            remove(readyOrder, e.spaceCraftId);
                            closeSegment(e.spaceCraftId, e.tick);
                            results.get(e.spaceCraftId).killed = e.tick;
                        } else if (effect.kind === 'port-down') {
                            portsDown = true;
                            outages.push({start: e.tick, end: null});
                        } else if (effect.kind === 'port-up') {
                            portsDown = false;
                            if (outages.length > 0) outages[outages.length - 1].end = e.tick;
                        }
                    }
                    break;
                default:
                    // AGING e tipos futuros: ignorados nesta versão do contrato
                    break;
            }
        }

        const snapshot = {};
        for (const s of ships) {
            const ship = live.get(s.id);
            snapshot[s.id] = {
                state: ship.state,
                portId: ship.portId,
                burst: ship.burst,
                remaining: Math.max(0, ship.burst - ship.executed),
                waiting: ship.waiting,
                slot: readyOrder.indexOf(s.id),
                struck: ship.struck,
                boosted: ship.boosted,
                exit: ship.exit,
            };
        }
        frames.push({tick, ships: snapshot, readyCount: readyOrder.length, events: now, preemptions, portsDown});

        // O quadro vale para o intervalo [tick, tick + 1): só depois dele os contadores andam.
        // Com a porta interditada, a nave atracada fica parada.
        for (const ship of live.values()) {
            if (ship.state === 'RUNNING' && !portsDown) ship.executed++;
            if (ship.state === 'READY') ship.waiting++;
        }
    }

    // Trecho que a gravação não fechou (não deveria acontecer): fecha no fim para o Gantt não quebrar
    for (const segment of open.values()) segment.end = totalTicks;
    for (const outage of outages) outage.end ??= totalTicks;

    return {
        algorithm: String(recording.algorithm ?? ''),
        ships,
        urgentId,
        ports,
        totalTicks,
        frames,
        segments,
        outages,
        results,
        events,
        metrics: recording.metrics ?? null,
        threat: recording.threat ?? null,
    };
}

function remove(list, value) {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
}

/** Ticks que a nave passou na órbita de espera ao longo de toda a simulação; null se ela não terminou. */
export function totalWait(timeline, shipId) {
    const ship = timeline.ships.find(s => s.id === shipId);
    const finish = timeline.results.get(shipId)?.finish;
    return ship && finish != null ? finish - ship.arrivalTime - ship.burstTime : null;
}

/**
 * Frase em português para um evento, usada na legenda da cena e no registro.
 * @param situationOf opcional: devolve a situação da nave (ex.: "Feridos a bordo"), citada na chegada
 */
export function describeEvent(e, situationOf = null) {
    switch (e.type) {
        case 'ARRIVAL': {
            const situation = situationOf?.(e.spaceCraftId);
            return `${e.spaceCraftId} chegou e entrou na órbita de espera` + (situation ? ` (${situation})` : '');
        }
        case 'DISPATCH':
            return `${e.spaceCraftId} atracou na porta ${e.portId}`;
        case 'PREEMPT':
            return `${e.spaceCraftId} recuou da porta ${e.portId} (preempção)`;
        case 'FINISH':
            return `${e.spaceCraftId} concluiu e deixou a porta ${e.portId}`;
        case 'THREAT':
            return e.text ?? 'ameaça';
        default:
            return `${e.spaceCraftId}: ${e.type}`;
    }
}
