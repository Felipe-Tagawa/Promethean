// Estado da cena de sincronismo, reconstruído a partir dos eventos (seção 4.3 do contrato).
// Cada nave é uma thread; cada braço é um recurso protegido (ou não) por uma primitiva de sincronização.

import {PALETTE} from '../palette.js';

const RESOURCE_LABELS = {
    ROBOTIC_ARM: 'braço robótico',
    ROBOTIC_ARMS: 'braço robótico',
    TELEMETRY_LINK: 'link de telemetria',
};
const POOL_LABELS = {
    ROBOTIC_ARMS: 'braços robóticos',
};

/** Letra de um braço nomeado ("A" para ROBOTIC_ARM_A); vazio para os outros recursos. */
export function resourceShort(id) {
    const match = /^ROBOTIC_ARM_(\w+)$/.exec(id);
    return match ? match[1] : '';
}

/** Nome de um recurso para mostrar na tela; ids desconhecidos aparecem como vieram. */
export function resourceLabel(id, capacity = 1) {
    const letter = resourceShort(id);
    if (letter) return `braço ${letter}`;
    if (capacity > 1 && POOL_LABELS[id]) return POOL_LABELS[id];
    return RESOURCE_LABELS[id] ?? String(id);
}

/** Um recurso com capacidade maior que 1 é um conjunto: a nave pede "um braço", qualquer que esteja livre. */
export function isPool(resource) {
    return resource.capacity > 1;
}

const SINGLE_ARMS = ['ROBOTIC_ARM', 'ROBOTIC_ARMS'];

/** Como chamar o que a nave segura: "A", "braço 2" (posição no conjunto), "braço" ou o nome do recurso. */
export function heldName(resource, shipId) {
    const letter = resourceShort(resource.id);
    if (letter) return letter;
    if (isPool(resource)) return `braço ${(resource.places.get(shipId) ?? 0) + 1}`;
    return SINGLE_ARMS.includes(resource.id) ? 'braço' : resourceLabel(resource.id);
}

/** Como chamar o que a nave espera: "A", "um braço" (qualquer um do conjunto), "o braço" ou o nome do recurso. */
export function wantedName(resource) {
    const letter = resourceShort(resource.id);
    if (letter) return letter;
    if (isPool(resource)) return 'um braço';
    return SINGLE_ARMS.includes(resource.id) ? 'o braço' : resourceLabel(resource.id);
}

/** Monta o estado inicial a partir de um evento SYNC_START. */
export function createState(start) {
    return {
        scenario: String(start.scenario ?? '').toUpperCase(),
        sync: Boolean(start.sync),
        recovery: String(start.recovery ?? 'NONE').toUpperCase(),
        ships: (start.spacecrafts ?? []).map((id, index) => newShip(String(id), index)),
        resources: (start.resources ?? []).map(r => newResource(String(r.id), Number(r.capacity ?? 1))),
        collisions: 0,
        deadlock: [],  // naves do ciclo, enquanto a estação está travada
        end: null,     // o evento SYNC_END, quando chegar
        waitCounter: 0,
    };
}

function newShip(id, index) {
    return {id, order: index, color: PALETTE[index % PALETTE.length], holds: [], waitsFor: null, waitSince: 0, done: false};
}

function newResource(id, capacity) {
    // places: em qual posição do conjunto (0, 1, 2...) cada nave está; só importa quando a capacidade é maior que 1
    return {id, capacity: Math.max(1, capacity), holders: [], places: new Map()};
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

export function findResource(state, id) {
    return state.resources.find(r => r.id === String(id));
}

/** Naves que ocupam uma posição do recurso, na ordem em que chegaram. */
export function occupants(resource, slot) {
    return resource.holders.filter(id => resource.places.get(id) === slot);
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
    let resource = findResource(state, id);
    if (!resource) {
        resource = newResource(String(id), 1);
        state.resources.push(resource);
    }
    return resource;
}

function removeFrom(list, value) {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
}

/** Posição menos ocupada do recurso; com sincronismo é sempre uma posição livre. */
function freeSlot(resource) {
    let best = 0;
    for (let slot = 1; slot < resource.capacity; slot++) {
        if (occupants(resource, slot).length < occupants(resource, best).length) best = slot;
    }
    return best;
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
            if (!resource.holders.includes(ship.id)) {
                resource.places.set(ship.id, freeSlot(resource));
                resource.holders.push(ship.id);
            }
            break;
        }
        case 'RELEASE': {
            const ship = shipOf(state, event.spaceCraftId);
            const resource = resourceOf(state, event.resourceId);
            removeFrom(ship.holds, resource.id);
            removeFrom(resource.holders, ship.id);
            resource.places.delete(ship.id);
            break;
        }
        case 'COLLISION': {
            const resource = resourceOf(state, event.resourceId);
            const latest = resource.holders[resource.holders.length - 1];
            state.collisions++;
            effects.push({kind: 'collision', resourceId: resource.id, slot: resource.places.get(latest) ?? 0});
            break;
        }
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

export function joinNames(ids) {
    const names = ids.map(String);
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

const SCENARIO_NAMES = {RACE: 'disputa pelos braços', DEADLOCK: 'deadlock'};

/**
 * Frases em português para um grupo de eventos que aconteceram juntos.
 * Deve ser chamada antes de aplicar o grupo, pois olha quem segurava o recurso no momento do pedido.
 */
export function describeBatch(state, batch) {
    const lines = [];
    for (let i = 0; i < batch.length; i++) {
        const e = batch[i];
        const next = batch[i + 1];
        const resource = e.resourceId != null ? findResource(state, e.resourceId) : null;
        const pool = Boolean(resource && isPool(resource));
        const label = e.resourceId != null ? resourceLabel(e.resourceId) : '';
        const some = pool ? 'um braço' : `o ${label}`; // o que a nave pede ou passa a usar
        switch (e.type) {
            case 'SYNC_START':
                lines.push(`Cenário iniciado: ${SCENARIO_NAMES[String(e.scenario).toUpperCase()] ?? e.scenario}, `
                    + `${(e.spacecrafts ?? []).length} naves, sincronismo ${e.sync ? 'ligado' : 'desligado'}`);
                break;
            case 'REQUEST':
                if (next && next.type === 'ACQUIRE' && next.spaceCraftId === e.spaceCraftId && next.resourceId === e.resourceId) {
                    lines.push(`${e.spaceCraftId} pediu ${some} e passou a usá-lo`);
                    i++;
                } else if (pool) {
                    lines.push(`${e.spaceCraftId} pediu um braço e ficou bloqueada: os ${resource.capacity} estão ocupados`);
                } else {
                    const holders = resource?.holders ?? [];
                    const owner = holders.length > 0 ? `: ele está com a ${joinNames(holders)}` : '';
                    lines.push(`${e.spaceCraftId} pediu ${some} e ficou bloqueada${owner}`);
                }
                break;
            case 'ACQUIRE':
                lines.push(`${e.spaceCraftId} passou a usar ${some}`);
                break;
            case 'RELEASE':
                lines.push(`${e.spaceCraftId} soltou o ${pool ? 'braço' : label}`);
                break;
            case 'COLLISION': {
                const ids = e.spaceCraftIds ?? [];
                lines.push(pool
                    ? `Colisão: ${ids.length} naves para ${resource.capacity} braços (${joinNames(ids)})`
                    : `Colisão no ${label}: ${joinNames(ids)} ao mesmo tempo`);
                break;
            }
            case 'DEADLOCK_DETECTED':
                lines.push(`Deadlock detectado: ${joinNames(e.spaceCraftIds ?? [])} esperam em ciclo`);
                break;
            case 'VICTIM_ABORTED':
                lines.push(`${e.spaceCraftId} foi escolhida como vítima e recua`);
                break;
            case 'TIMEOUT':
                lines.push(`${e.spaceCraftId} cansou de esperar ${some} e desistiu`);
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
