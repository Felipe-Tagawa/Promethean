// Cena de sincronismo em SVG: as naves (threads) disputam os braços robóticos (recursos) da estação.
// Aceita qualquer quantidade de naves e braços; com muitos, as naves são desenhadas menores.

import {svg, text, arrow} from '../svg.js';
import {drawHull} from '../hulls.js';
import {drawSky, drawStationBody, drawStationHub} from '../stations.js';
import {hullFor} from '../universe.js';
import {statusOf, resourceLabel, resourceShort, isPool, heldName, wantedName, occupants, findResource, joinNames} from './model.js';

const STATION = {x: 858, y: 250};
const JOINT_X = 752;   // cotovelo do braço
const CLAW_X = 652;    // garra na ponta do braço
const STANDBY_X = 72;  // naves sem recurso e sem pedido
const TOP = 60;        // faixa vertical usada por braços e naves
const BOTTOM = 420;

function capitalize(label) {
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Distribui `count` itens na faixa vertical da cena, com no máximo `maxSpacing` entre eles. */
function spread(index, count, maxSpacing) {
    const spacing = count > 1 ? Math.min(maxSpacing, (BOTTOM - TOP) / (count - 1)) : 0;
    return (TOP + BOTTOM) / 2 + (index - (count - 1) / 2) * spacing;
}

export class SyncScene {

    /** @param universe o universo em uso (universe.js): define o fundo, a estação e os cascos */
    constructor(root, universe) {
        this.root = root;
        this.universe = universe;
        this.signature = '';
        this.arms = new Map();   // "recurso#posição" -> braço desenhado
        this.ships = new Map();
        this.edges = new Map();
        this.metrics = {scale: 1.3, bayX: 588, queueStep: 150};

        this.backdrop = svg('g', {class: 'backdrop'}, root);
        this.armLayer = svg('g', {class: 'arms'}, root);
        this.edgeLayer = svg('g', {class: 'edges'}, root);
        this.shipLayer = svg('g', {class: 'ships'}, root);
        this.buildBackdrop();
    }

    /** Troca o universo: refaz o fundo e a estação. Braços e naves são refeitos no próximo render. */
    setUniverse(universe) {
        this.universe = universe;
        this.buildBackdrop();
        this.signature = '';
    }

    buildBackdrop() {
        this.backdrop.replaceChildren();
        drawSky(this.backdrop, this.universe.key);

        const station = svg('g', {class: 'station', 'aria-hidden': 'true'}, this.backdrop);
        drawStationBody(station, this.universe.key, STATION.x, STATION.y, true);

        const legend = svg('g', {class: 'scene-legend'}, this.backdrop);
        text('nave = thread · braço robótico = recurso compartilhado', {x: 18, y: 478}, legend);
        text('seta tracejada = a nave presa a um braço espera o outro', {x: 18, y: 494}, legend);
    }

    armKey(resourceId, slot = 0) {
        return `${resourceId}#${slot}`;
    }

    /** Refaz braços e naves quando o cenário muda de naves ou de recursos. */
    build(state) {
        this.armLayer.replaceChildren();
        this.edgeLayer.replaceChildren();
        this.shipLayer.replaceChildren();
        this.arms.clear();
        this.ships.clear();
        this.edges.clear();

        const slots = state.resources.flatMap(resource =>
            Array.from({length: resource.capacity}, (_, slot) => ({resource, slot})));

        // Com muitas naves ou braços, tudo é desenhado menor para caber
        const scale = state.ships.length > 4 || slots.length > 2 ? 1 : 1.3;
        const bayX = CLAW_X - 17 - 36 * scale;
        const longestQueue = Math.max(1, state.ships.length - 1);
        this.metrics = {scale, bayX, queueStep: Math.min(scale > 1 ? 150 : 118, (bayX - 110) / longestQueue)};

        slots.forEach(({resource, slot}, index) => {
            const y = spread(index, slots.length, 200);
            const g = svg('g', {class: 'arm', 'data-busy': 'false', 'data-over': 'false'}, this.armLayer);
            svg('path', {class: 'arm-link', d: `M${STATION.x} ${STATION.y} L${JOINT_X} ${y} L${CLAW_X + 6} ${y}`}, g);
            svg('circle', {class: 'arm-joint', cx: JOINT_X, cy: y, r: 8}, g);
            svg('circle', {class: 'arm-claw', cx: CLAW_X, cy: y, r: 10}, g);
            const half = 40 * scale;
            svg('rect', {class: 'port-slot', x: bayX - half, y: y - 15 * scale, width: half * 2, height: 30 * scale, rx: 13 * scale}, g);

            const label = isPool(resource) ? `Braço ${slot + 1}` : capitalize(resourceLabel(resource.id));
            text(label, {x: CLAW_X + 30, y: y - 16, class: 'arm-label'}, g);
            const status = text('livre', {x: CLAW_X + 30, y: y + 28, class: 'arm-status'}, g);

            const burst = svg('g', {class: 'burst'}, g);
            burst.style.transformOrigin = `${bayX}px ${y}px`;
            const points = [];
            for (let i = 0; i < 20; i++) {
                const radius = (i % 2 === 0 ? 36 : 17) * scale;
                const angle = i * Math.PI / 10;
                points.push(`${(bayX + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`);
            }
            svg('polygon', {points: points.join(' ')}, burst);

            this.arms.set(this.armKey(resource.id, slot), {g, status, burst, y});
        });

        // O centro da estação fica por cima dos braços
        const hub = svg('g', {class: 'hub-group', 'aria-hidden': 'true'}, this.armLayer);
        drawStationHub(hub, this.universe.key, STATION.x, STATION.y);

        state.ships.forEach(ship => {
            const g = svg('g', {class: 'ship', 'data-state': 'READY'}, this.shipLayer);
            g.style.setProperty('--ship-color', ship.color);
            const bob = svg('g', {class: 'ship-bob'}, g);
            bob.style.animationDelay = `${-(ship.order * 0.7)}s`;
            drawHull(svg('g', {class: 'ship-shake'}, bob), scale, hullFor(this.universe, ship.order));
            text(ship.id, {y: -(11 * scale + 16), 'text-anchor': 'middle', class: 'ship-id'}, bob);
            const note = text('', {y: 11 * scale + 24, 'text-anchor': 'middle', class: 'ship-rest'}, bob);
            this.ships.set(ship.id, {g, note});
        });
    }

    /**
     * @param state estado atual (model.js)
     * @param effects efeitos passageiros devolvidos por applyEvent
     * @param animate false = posiciona sem transição (troca de cenário)
     */
    render(state, effects = [], animate = true) {
        const signature = JSON.stringify([state.ships.map(s => s.id), state.resources.map(r => [r.id, r.capacity])]);
        if (signature !== this.signature) {
            this.signature = signature;
            this.build(state);
            animate = false;
        }
        if (!animate) this.root.classList.add('no-anim');

        this.root.dataset.sync = String(state.sync);
        this.root.dataset.deadlock = String(state.deadlock.length > 0);
        const colors = new Map(state.ships.map(s => [s.id, s.color]));

        for (const resource of state.resources) {
            for (let slot = 0; slot < resource.capacity; slot++) {
                const arm = this.arms.get(this.armKey(resource.id, slot));
                const here = occupants(resource, slot);
                arm.g.dataset.busy = String(here.length > 0);
                arm.g.dataset.over = String(here.length > 1);
                arm.g.style.setProperty('--holder', colors.get(here[0]) ?? 'currentColor');
                if (here.length === 0) arm.status.textContent = 'livre';
                else if (here.length > 1) arm.status.textContent = `${joinNames(here)} ao mesmo tempo`;
                else arm.status.textContent = `em uso por ${here[0]}`;
            }
        }

        for (const ship of state.ships) {
            const view = this.ships.get(ship.id);
            const place = this.placeFor(ship, state);
            view.g.dataset.state = statusOf(ship);
            view.g.style.transform = `translate(${place.x.toFixed(1)}px, ${place.y.toFixed(1)}px)`;
            view.g.classList.toggle('in-deadlock', state.deadlock.includes(ship.id));
            view.note.textContent = this.noteFor(ship, state);
        }

        this.renderEdges(state);

        if (!animate) {
            void this.root.getBoundingClientRect();
            this.root.classList.remove('no-anim');
        }

        for (const effect of effects) {
            if (effect.kind === 'collision') {
                const arm = this.arms.get(this.armKey(effect.resourceId, effect.slot));
                if (arm) this.replay(arm.burst, 'is-bursting');
                const resource = findResource(state, effect.resourceId);
                for (const id of resource ? occupants(resource, effect.slot) : []) {
                    this.replay(this.ships.get(id).g, 'is-shaking');
                }
            } else if (this.ships.has(effect.shipId)) {
                this.replay(this.ships.get(effect.shipId).g, 'is-flashing');
            }
        }
    }

    /** O braço junto do qual a nave fica: o primeiro que ela pegou. */
    homeArm(ship, state) {
        const resource = findResource(state, ship.holds[0]);
        return resource ? this.arms.get(this.armKey(resource.id, resource.places.get(ship.id) ?? 0)) : null;
    }

    placeFor(ship, state) {
        const {bayX, queueStep} = this.metrics;
        if (ship.done) return {x: 1090, y: 40};

        if (ship.holds.length > 0) {
            // Se há mais de uma nave no mesmo braço (colisão), elas ficam sobrepostas
            const resource = findResource(state, ship.holds[0]);
            const slot = resource.places.get(ship.id) ?? 0;
            const position = Math.max(0, occupants(resource, slot).indexOf(ship.id));
            return {x: bayX - position * 22, y: this.arms.get(this.armKey(resource.id, slot)).y + position * 20};
        }

        const wanted = ship.waitsFor !== null ? findResource(state, ship.waitsFor) : null;
        if (wanted) {
            const queue = state.ships
                .filter(s => !s.done && s.holds.length === 0 && s.waitsFor === wanted.id)
                .sort((a, b) => a.waitSince - b.waitSince);
            // A fila de um conjunto de braços fica na altura do meio deles
            let y = 0;
            for (let slot = 0; slot < wanted.capacity; slot++) y += this.arms.get(this.armKey(wanted.id, slot)).y;
            return {x: bayX - queueStep * (queue.indexOf(ship) + 1), y: y / wanted.capacity};
        }

        return {x: STANDBY_X, y: spread(ship.order, state.ships.length, 112)};
    }

    noteFor(ship, state) {
        const holds = ship.holds.map(id => heldName(findResource(state, id), ship.id));
        const wanted = ship.waitsFor !== null ? wantedName(findResource(state, ship.waitsFor)) : null;
        if (wanted) {
            if (holds.length > 0) return `tem ${holds.join(' e ')} · espera ${wanted}`;
            // Na fila de um braço nomeado diz qual é; na do conjunto o texto curto evita sobreposição
            return resourceShort(ship.waitsFor) ? `espera ${wanted}` : 'na fila';
        }
        if (holds.length === 0) return ''; // pronta: o estado já aparece na tabela
        return /^braço/.test(holds[0]) ? `usando o ${holds.join(' e ')}` : `usando ${holds.join(' e ')}`;
    }

    /**
     * Setas entre os braços, na mesma notação do grafo:
     * tracejada = a nave presa a um braço espera o outro (é o que fecha o ciclo do deadlock);
     * cheia = um segundo braço que a nave também está usando.
     */
    renderEdges(state) {
        const wanted = new Map();
        for (const ship of state.ships) {
            if (ship.done || ship.holds.length === 0) continue;
            const home = this.homeArm(ship, state);
            const waiting = ship.waitsFor !== null ? this.arms.get(this.armKey(ship.waitsFor)) : null;
            if (home && waiting && waiting !== home && !isPool(findResource(state, ship.waitsFor))) {
                wanted.set(`${ship.id}>${ship.waitsFor}`, {ship, from: home, to: waiting, kind: 'edge-wait'});
            }
            for (const id of ship.holds.slice(1)) {
                const other = this.arms.get(this.armKey(id, findResource(state, id).places.get(ship.id) ?? 0));
                if (home && other && other !== home) {
                    wanted.set(`${id}>${ship.id}`, {ship, from: other, to: home, kind: 'edge-hold'});
                }
            }
        }

        for (const [key, edge] of this.edges) {
            if (!wanted.has(key)) {
                edge.remove();
                this.edges.delete(key);
            }
        }
        for (const [key, {ship, from, to, kind}] of wanted) {
            if (!this.edges.has(key)) {
                const down = to.y > from.y;
                const x = CLAW_X + (down ? -13 : 13); // ida e volta em lados opostos, para não se sobreporem
                const edge = arrow(this.edgeLayer, x, from.y + (down ? 16 : -16), x, to.y + (down ? -14 : 14), `edge ${kind}`);
                edge.style.color = ship.color;
                this.edges.set(key, edge);
            }
            this.edges.get(key).classList.toggle('is-deadlock', state.deadlock.includes(ship.id));
        }
    }

    /** Dispara de novo uma animação CSS, mesmo que a classe já esteja no elemento. */
    replay(node, className) {
        node.classList.remove(className);
        void node.getBoundingClientRect();
        node.classList.add(className);
    }
}
