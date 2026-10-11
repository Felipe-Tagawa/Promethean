// Cena de sincronismo em SVG: as naves (threads) disputam os braços robóticos (recursos) da estação.

import {svg, text, drawSky, drawHull, arrow} from '../svg.js';
import {statusOf, resourceLabel, resourceShort} from './model.js';

const STATION = {x: 858, y: 250};
const JOINT_X = 752;   // cotovelo do braço
const CLAW_X = 652;    // garra na ponta do braço
const BAY_X = 588;     // centro da nave que está usando o braço
const QUEUE_STEP = 150; // distância entre as naves que esperam na fila de um braço
const STANDBY_X = 72;  // naves sem recurso e sem pedido
const SHIP_SCALE = 1.3;

function capitalize(label) {
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function names(ids) {
    return ids.length <= 1 ? ids.join('') : `${ids.slice(0, -1).join(', ')} e ${ids[ids.length - 1]}`;
}

export class SyncScene {

    constructor(root) {
        this.root = root;
        this.signature = '';
        this.arms = new Map();
        this.ships = new Map();
        this.edges = new Map();

        drawSky(root);
        this.buildStation();
        this.armLayer = svg('g', {class: 'arms'}, root);
        this.edgeLayer = svg('g', {class: 'edges'}, root);
        this.shipLayer = svg('g', {class: 'ships'}, root);

        const legend = svg('g', {class: 'scene-legend'}, root);
        text('nave = thread · braço robótico = recurso compartilhado', {x: 18, y: 462}, legend);
        text('seta tracejada = a nave presa a um braço espera o outro', {x: 18, y: 482}, legend);
    }

    buildStation() {
        const g = svg('g', {class: 'station', 'aria-hidden': 'true'}, this.root);
        const {x, y} = STATION;
        for (const dir of [-1, 1]) {
            svg('line', {x1: x + 30, y1: y + dir * 40, x2: x + 62, y2: y + dir * 96, class: 'station-strut'}, g);
            const top = dir < 0 ? y - 144 : y + 96;
            svg('rect', {x: x + 26, y: top, width: 80, height: 48, rx: 3, class: 'solar'}, g);
            for (let i = 1; i < 4; i++) {
                svg('line', {x1: x + 26 + i * 20, y1: top, x2: x + 26 + i * 20, y2: top + 48, class: 'solar-grid'}, g);
            }
            svg('line', {x1: x + 26, y1: top + 24, x2: x + 106, y2: top + 24, class: 'solar-grid'}, g);
        }
        const ring = svg('circle', {cx: x, cy: y, r: 60, class: 'hub-ring'}, g);
        ring.style.transformOrigin = `${x}px ${y}px`;
        this.hub = svg('g', {class: 'hub-group'}, this.root); // fica por cima dos braços
        svg('circle', {cx: x, cy: y, r: 46, class: 'hub'}, this.hub);
        svg('circle', {cx: x, cy: y, r: 26, class: 'hub-core'}, this.hub);
        svg('circle', {cx: x, cy: y, r: 8, class: 'hub-light'}, this.hub);
    }

    bayY(index, count) {
        const spacing = count > 1 ? Math.min(200, 380 / (count - 1)) : 0;
        return STATION.y + (index - (count - 1) / 2) * spacing;
    }

    /** Refaz braços e naves quando o cenário muda de naves ou de recursos. */
    build(state) {
        this.armLayer.replaceChildren();
        this.edgeLayer.replaceChildren();
        this.shipLayer.replaceChildren();
        this.arms.clear();
        this.ships.clear();
        this.edges.clear();

        state.resources.forEach((resource, index) => {
            const y = this.bayY(index, state.resources.length);
            const g = svg('g', {class: 'arm', 'data-busy': 'false', 'data-over': 'false'}, this.armLayer);
            svg('path', {class: 'arm-link', d: `M${STATION.x} ${STATION.y} L${JOINT_X} ${y} L${CLAW_X + 6} ${y}`}, g);
            svg('circle', {class: 'arm-joint', cx: JOINT_X, cy: y, r: 8}, g);
            svg('circle', {class: 'arm-claw', cx: CLAW_X, cy: y, r: 10}, g);
            svg('rect', {class: 'port-slot', x: BAY_X - 52, y: y - 20, width: 104, height: 40, rx: 18}, g);
            text(capitalize(resourceLabel(resource.id)), {x: CLAW_X + 30, y: y - 18, class: 'arm-label'}, g);
            const status = text('livre', {x: CLAW_X + 30, y: y + 30, class: 'arm-status'}, g);

            const burst = svg('g', {class: 'burst'}, g);
            burst.style.transformOrigin = `${BAY_X}px ${y}px`;
            const points = [];
            for (let i = 0; i < 20; i++) {
                const radius = i % 2 === 0 ? 46 : 22;
                const angle = i * Math.PI / 10;
                points.push(`${(BAY_X + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`);
            }
            svg('polygon', {points: points.join(' ')}, burst);

            this.arms.set(resource.id, {g, status, burst, y});
        });

        state.ships.forEach(ship => {
            const g = svg('g', {class: 'ship', 'data-state': 'READY'}, this.shipLayer);
            g.style.setProperty('--ship-color', ship.color);
            const bob = svg('g', {class: 'ship-bob'}, g);
            bob.style.animationDelay = `${-(ship.order * 0.7)}s`;
            drawHull(svg('g', {class: 'ship-shake'}, bob), SHIP_SCALE);
            text(ship.id, {y: -30, 'text-anchor': 'middle', class: 'ship-id'}, bob);
            const note = text('', {y: 38, 'text-anchor': 'middle', class: 'ship-rest'}, bob);
            this.ships.set(ship.id, {g, note});
        });
    }

    /**
     * @param state estado atual (model.js)
     * @param effects efeitos passageiros devolvidos por applyEvent
     * @param animate false = posiciona sem transição (troca de cenário)
     */
    render(state, effects = [], animate = true) {
        const signature = JSON.stringify([state.ships.map(s => s.id), state.resources.map(r => r.id)]);
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
            const arm = this.arms.get(resource.id);
            const over = resource.holders.length > resource.capacity;
            arm.g.dataset.busy = String(resource.holders.length > 0);
            arm.g.dataset.over = String(over);
            arm.g.style.setProperty('--holder', colors.get(resource.holders[0]) ?? 'currentColor');
            if (resource.holders.length === 0) arm.status.textContent = 'livre';
            else if (over) arm.status.textContent = `${names(resource.holders)} ao mesmo tempo`;
            else arm.status.textContent = `em uso por ${names(resource.holders)}`;
        }

        for (const ship of state.ships) {
            const view = this.ships.get(ship.id);
            const place = this.placeFor(ship, state);
            view.g.dataset.state = statusOf(ship);
            view.g.style.transform = `translate(${place.x.toFixed(1)}px, ${place.y.toFixed(1)}px)`;
            view.g.classList.toggle('in-deadlock', state.deadlock.includes(ship.id));
            view.note.textContent = this.noteFor(ship);
        }

        this.renderEdges(state);

        if (!animate) {
            void this.root.getBoundingClientRect();
            this.root.classList.remove('no-anim');
        }

        for (const effect of effects) {
            if (effect.kind === 'collision') {
                const arm = this.arms.get(effect.resourceId);
                if (arm) this.replay(arm.burst, 'is-bursting');
                const resource = state.resources.find(r => r.id === effect.resourceId);
                for (const id of resource?.holders ?? []) this.replay(this.ships.get(id).g, 'is-shaking');
            } else if (this.ships.has(effect.shipId)) {
                this.replay(this.ships.get(effect.shipId).g, 'is-flashing');
            }
        }
    }

    placeFor(ship, state) {
        if (ship.done) return {x: 1090, y: 40};

        if (ship.holds.length > 0) {
            // Fica junto do primeiro braço que pegou; se há mais de uma nave nele, elas se sobrepõem
            const resource = state.resources.find(r => r.id === ship.holds[0]);
            const position = Math.max(0, resource.holders.indexOf(ship.id));
            return {x: BAY_X - position * 22, y: this.arms.get(resource.id).y + position * 20};
        }

        if (ship.waitsFor !== null && this.arms.has(ship.waitsFor)) {
            const queue = state.ships
                .filter(s => !s.done && s.holds.length === 0 && s.waitsFor === ship.waitsFor)
                .sort((a, b) => a.waitSince - b.waitSince);
            return {x: BAY_X - QUEUE_STEP * (queue.indexOf(ship) + 1), y: this.arms.get(ship.waitsFor).y};
        }

        const count = state.ships.length;
        const spacing = count > 1 ? Math.min(112, 400 / (count - 1)) : 0;
        return {x: STANDBY_X, y: STATION.y + (ship.order - (count - 1) / 2) * spacing};
    }

    noteFor(ship) {
        const holds = ship.holds.map(resourceShort).join(' e ');
        if (ship.waitsFor !== null) {
            const wanted = resourceShort(ship.waitsFor);
            return holds ? `tem ${holds} · espera ${wanted}` : `bloqueada: espera ${wanted}`;
        }
        return holds ? `usando ${holds}` : 'pronta';
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
            const home = this.arms.get(ship.holds[0]); // a nave fica junto do primeiro braço que pegou
            const waiting = this.arms.get(ship.waitsFor);
            if (home && waiting && waiting !== home) {
                wanted.set(`${ship.id}>${ship.waitsFor}`, {ship, from: home, to: waiting, kind: 'edge-wait'});
            }
            for (const id of ship.holds.slice(1)) {
                const other = this.arms.get(id);
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
