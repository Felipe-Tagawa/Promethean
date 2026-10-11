// Reconstrói o estado da estação em cada tick a partir da gravação (seção 3.4 do contrato).
// O front não recebe o estado pronto: ele aplica os eventos em ordem. É isso que permite voltar no tempo.

import {PALETTE} from './palette.js';

/**
 * @param recording gravação devolvida pelo servidor (ou um arquivo de exemplo)
 * @returns naves, portas, um quadro por tick, os trechos do Gantt e os tempos de cada nave
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

    const events = recording.events.map(e => ({...e, tick: Number(e.tick), spaceCraftId: String(e.spaceCraftId)}));
    for (const e of events) {
        if (!byId.has(e.spaceCraftId)) {
            throw new Error(`O evento ${e.type} do tick ${e.tick} cita a nave "${e.spaceCraftId}", que não está na carga.`);
        }
    }

    let ports = Array.isArray(recording.ports) ? recording.ports.map(String) : [];
    if (ports.length === 0) {
        ports = [...new Set(events.filter(e => e.portId != null).map(e => String(e.portId)))];
    }

    const totalTicks = events.reduce((max, e) => Math.max(max, e.tick), 0);

    // Estado que vai sendo alterado tick a tick
    const live = new Map(ships.map(s => [s.id, {state: 'NEW', portId: null, executed: 0, waiting: 0}]));
    const readyOrder = []; // ordem em que as naves entraram em READY
    const open = new Map(); // nave -> trecho do Gantt ainda aberto
    const segments = [];
    const results = new Map(ships.map(s => [s.id, {start: null, finish: null}]));
    const frames = [];
    let preemptions = 0;
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
                remaining: Math.max(0, s.burstTime - ship.executed),
                waiting: ship.waiting,
                slot: readyOrder.indexOf(s.id),
            };
        }
        frames.push({tick, ships: snapshot, readyCount: readyOrder.length, events: now, preemptions});

        // O quadro vale para o intervalo [tick, tick + 1): só depois dele os contadores andam
        for (const ship of live.values()) {
            if (ship.state === 'RUNNING') ship.executed++;
            if (ship.state === 'READY') ship.waiting++;
        }
    }

    // Trecho que a gravação não fechou (não deveria acontecer): fecha no fim para o Gantt não quebrar
    for (const segment of open.values()) segment.end = totalTicks;

    return {
        algorithm: String(recording.algorithm ?? ''),
        ships,
        ports,
        totalTicks,
        frames,
        segments,
        results,
        events,
        metrics: recording.metrics ?? null,
    };
}

function remove(list, value) {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
}

/** Frase em português para um evento, usada na legenda da cena e no registro. */
export function describeEvent(e) {
    switch (e.type) {
        case 'ARRIVAL':
            return `${e.spaceCraftId} chegou e entrou na órbita de espera`;
        case 'DISPATCH':
            return `${e.spaceCraftId} atracou na porta ${e.portId}`;
        case 'PREEMPT':
            return `${e.spaceCraftId} recuou da porta ${e.portId} (preempção)`;
        case 'FINISH':
            return `${e.spaceCraftId} concluiu e deixou a porta ${e.portId}`;
        default:
            return `${e.spaceCraftId}: ${e.type}`;
    }
}
