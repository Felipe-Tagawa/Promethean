// Estado da cena de sincronismo, reconstruído a partir dos eventos (seção 4.3 do contrato).
// Cada nave é uma thread; cada braço é um recurso protegido (ou não) por uma primitiva de sincronização.

import {PALETTE} from '../palette.js';

const RESOURCE_LABELS = {
    ROBOTIC_ARM: 'braço robótico',
    ROBOTIC_ARM_A: 'braço A',
    ROBOTIC_ARM_B: 'braço B',
    TELEMETRY_LINK: 'link de telemetria',
};

/** Nome de um recurso para mostrar na tela; ids desconhecidos aparecem como vieram. */
export function resourceLabel(id) {
    return RESOURCE_LABELS[id] ?? String(id);
}

/** Forma curta, para rótulos pequenos: "A" para o braço A. */
export function resourceShort(id) {
    const match = /^ROBOTIC_ARM_(\w+)$/.exec(id);
    return match ? match[1] : resourceLabel(id);
}

/** Monta o estado inicial a partir de um evento SYNC_START (ou de uma prévia com o mesmo formato). */
export function createState(start) {
    return {
        scenario: String(start.scenario ?? '').toUpperCase(),
        sync: Boolean(start.sync),
        recovery: String(start.recovery ?? 'NONE').toUpperCase(),
        ships: (start.spacecrafts ?? []).map((id, index) => newShip(String(id), index)),
        resources: (start.resources ?? []).map(r => ({id: String(r.id), capacity: Number(r.capacity ?? 1), holders: []})),
        collisions: 0,
        deadlock: [],  // naves do ciclo, enquanto a estação está travada
        end: null,     // o evento SYNC_END, quando chegar
        waitCounter: 0,
    };
}

function newShip(id, index) {
    return {id, order: index, color: PALETTE[index % PALETTE.length], holds: [], waitsFor: null, waitSince: 0, done: false};
}

/**
 * Estado de processo da nave:
 * READY = sem recurso e sem pedido; RUNNING = usando um recurso; BLOCKED = esperando um recurso; FINISHED = terminou.
 */
export function statusOf(ship) {
    if (ship.done) return 'FINISHED';
    if (ship.waitsFor !== null) return 'BLOCKED';
    if (ship.holds.length > 0) return 'RUNNING';
    return 'READY';
}

function shipOf(state, id) {
    let ship = state.ships.find(s => s.id === String(id));
    if (!ship) { // o contrato manda declarar as naves em SYNC_START, mas a tela não quebra se faltar uma
        ship = newShip(String(id), state.ships.length);
        state.ships.push(ship);
    }
    return ship;
}

function resourceOf(state, id) {
    let resource = state.resources.find(r => r.id === String(id));
    if (!resource) {
        resource = {id: String(id), capacity: 1, holders: []};
        state.resources.push(resource);
    }
    return resource;
}

function removeFrom(list, value) {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
}

/**
 * Aplica um evento ao estado.
 * @returns efeitos passageiros para a cena animar: {kind: 'collision' | 'victim' | 'timeout', ...}
 */
export function applyEvent(state, event) {
    const effects = [];
    switch (event.type) {
        case 'REQUEST': {
            const ship = shipOf(state, event.spaceCraftId);
            resourceOf(state, event.resourceId);
            ship.waitsFor = String(event.resourceId);
            ship.waitSince = state.waitCounter++;
            break;
        }
        case 'ACQUIRE': {
            const ship = shipOf(state, event.spaceCraftId);
            const resource = resourceOf(state, event.resourceId);
            if (ship.waitsFor === resource.id) ship.waitsFor = null;
            if (!ship.holds.includes(resource.id)) ship.holds.push(resource.id);
            if (!resource.holders.includes(ship.id)) resource.holders.push(ship.id);
            break;
        }
        case 'RELEASE': {
            const ship = shipOf(state, event.spaceCraftId);
            const resource = resourceOf(state, event.resourceId);
            removeFrom(ship.holds, resource.id);
            removeFrom(resource.holders, ship.id);
            break;
        }
        case 'COLLISION':
            state.collisions++;
            effects.push({kind: 'collision', resourceId: String(event.resourceId)});
            break;
        case 'DEADLOCK_DETECTED':
            state.deadlock = (event.spaceCraftIds ?? []).map(String);
            break;
        case 'VICTIM_ABORTED': {
            const ship = shipOf(state, event.spaceCraftId);
            ship.waitsFor = null;
            state.deadlock = [];
            effects.push({kind: 'victim', shipId: ship.id});
            break;
        }
        case 'TIMEOUT': {
            const ship = shipOf(state, event.spaceCraftId);
            ship.waitsFor = null;
            state.deadlock = [];
            effects.push({kind: 'timeout', shipId: ship.id});
            break;
        }
        case 'DONE':
            shipOf(state, event.spaceCraftId).done = true;
            break;
        case 'SYNC_END':
            state.end = event;
            if (event.reason !== 'DEADLOCKED') state.deadlock = [];
            break;
        default:
            // SYNC_START é tratado por createState; tipos futuros são ignorados
            break;
    }
    return effects;
}

function joinNames(ids) {
    const names = ids.map(String);
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

const SCENARIO_NAMES = {RACE: 'disputa pelo braço', DEADLOCK: 'deadlock'};

/**
 * Frases em português para um grupo de eventos que aconteceram juntos.
 * Deve ser chamada antes de aplicar o grupo, pois olha quem segurava o recurso no momento do pedido.
 */
export function describeBatch(state, batch) {
    const lines = [];
    for (let i = 0; i < batch.length; i++) {
        const e = batch[i];
        const next = batch[i + 1];
        const resource = e.resourceId != null ? resourceLabel(e.resourceId) : '';
        switch (e.type) {
            case 'SYNC_START':
                lines.push(`Cenário iniciado: ${SCENARIO_NAMES[String(e.scenario).toUpperCase()] ?? e.scenario}, `
                    + `sincronismo ${e.sync ? 'ligado' : 'desligado'}`);
                break;
            case 'REQUEST':
                if (next && next.type === 'ACQUIRE' && next.spaceCraftId === e.spaceCraftId && next.resourceId === e.resourceId) {
                    lines.push(`${e.spaceCraftId} pediu o ${resource} e passou a usá-lo`);
                    i++;
                } else {
                    const holders = state.resources.find(r => r.id === String(e.resourceId))?.holders ?? [];
                    const owner = holders.length > 0 ? `: ele está com a ${joinNames(holders)}` : '';
                    lines.push(`${e.spaceCraftId} pediu o ${resource} e ficou bloqueada${owner}`);
                }
                break;
            case 'ACQUIRE':
                lines.push(`${e.spaceCraftId} passou a usar o ${resource}`);
                break;
            case 'RELEASE':
                lines.push(`${e.spaceCraftId} soltou o ${resource}`);
                break;
            case 'COLLISION':
                lines.push(`Colisão no ${resource}: ${joinNames(e.spaceCraftIds ?? [])} ao mesmo tempo`);
                break;
            case 'DEADLOCK_DETECTED':
                lines.push(`Deadlock detectado: ${joinNames(e.spaceCraftIds ?? [])} esperam uma pela outra`);
                break;
            case 'VICTIM_ABORTED':
                lines.push(`${e.spaceCraftId} foi escolhida como vítima e recua`);
                break;
            case 'TIMEOUT':
                lines.push(`${e.spaceCraftId} cansou de esperar o ${resource} e desistiu`);
                break;
            case 'DONE':
                lines.push(`${e.spaceCraftId} terminou e partiu`);
                break;
            case 'SYNC_END':
                lines.push({
                    COMPLETED: 'Cenário concluído',
                    DEADLOCKED: 'Cenário encerrado com a estação travada',
                    STOPPED: 'Cenário interrompido',
                }[e.reason] ?? `Cenário encerrado (${e.reason})`);
                break;
            default:
                lines.push(String(e.type));
                break;
        }
    }
    return lines;
}
