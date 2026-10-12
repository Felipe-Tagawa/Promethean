// Cena da estação em SVG: órbita de espera (fila de prontos), portas (núcleos de CPU) e naves (processos).

import {svg, text} from './svg.js';
import {drawHull, drawEffect, HULL_NAMES} from './hulls.js';
import {drawSky, drawStationBody, drawStationHub, armStartOf} from './stations.js';
import {hullFor, priorityContext} from './universe.js';
import {drawIcon} from './icons.js';

const STATION = {x: 610, y: 250};
const ORBIT = {rx: 335, ry: 195};
const ARM_END = 100;    // do centro da estação até a ponta do braço de acoplamento
const DOCK_RADIUS = 152; // do centro da estação até o centro da nave atracada
const SHIP_SCALE = 1.3;
const GAUGE_WIDTH = 60;

/** Ponto a um ângulo (graus) do centro da estação. */
function polar(angle, radiusX, radiusY = radiusX) {
    const rad = angle * Math.PI / 180;
    return {x: STATION.x + radiusX * Math.cos(rad), y: STATION.y + radiusY * Math.sin(rad)};
}

export class Scene {

    /** @param universe o universo em uso (universe.js): define o fundo, a estação, os cascos e as situações */
    constructor(root, universe) {
        this.root = root;
        this.universe = universe;
        this.timeline = null;
        this.ships = new Map();
        this.ports = new Map();

        this.backdrop = svg('g', {class: 'backdrop'}, this.root);
        this.portLayer = svg('g', {class: 'ports'}, this.root);
        this.shipLayer = svg('g', {class: 'ships'}, this.root);
        this.buildBackdrop();
    }

    /** Troca o universo: refaz o fundo e a estação e, se já há uma simulação, as portas e as naves. */
    setUniverse(universe) {
        this.universe = universe;
        this.buildBackdrop();
        if (this.timeline) this.load(this.timeline);
    }

    buildBackdrop() {
        this.backdrop.replaceChildren();
        drawSky(this.backdrop, this.universe.key);

        const orbit = svg('g', {class: 'orbit'}, this.backdrop);
        svg('ellipse', {cx: STATION.x, cy: STATION.y, rx: ORBIT.rx, ry: ORBIT.ry, class: 'orbit-ring'}, orbit);
        text('Órbita de espera', {x: 150, y: 44, class: 'scene-label'}, orbit);
        text('fila de prontos · READY', {x: 150, y: 62, class: 'scene-sublabel'}, orbit);

        const legend = svg('g', {class: 'scene-legend'}, this.backdrop);
        text('porta de acoplamento = núcleo de CPU', {x: 18, y: 462}, legend);
        text('recuo da porta = preempção (troca de contexto)', {x: 18, y: 482}, legend);
        text('aging = a nave que espera muito sobe de prioridade', {x: 18, y: 442, class: 'legend-aging'}, legend);
        text('partidas', {x: 982, y: 30, 'text-anchor': 'end', class: 'scene-sublabel'}, this.backdrop);

        const station = svg('g', {class: 'station', 'aria-hidden': 'true'}, this.backdrop);
        drawStationBody(station, this.universe.key, STATION.x, STATION.y);
        drawStationHub(station, this.universe.key, STATION.x, STATION.y);
    }

    /** Monta as portas e as naves de uma simulação. */
    load(timeline) {
        this.timeline = timeline;
        this.portLayer.replaceChildren();
        this.shipLayer.replaceChildren();
        this.ports.clear();
        this.ships.clear();

        timeline.ports.forEach((id, index) => this.ports.set(id, this.buildPort(id, index, timeline.ports.length)));
        timeline.ships.forEach(ship => this.ships.set(ship.id, this.buildShip(ship)));
    }

    buildPort(id, index, count) {
        const angle = 180 + (index - (count - 1) / 2) * 46;
        const from = polar(angle, armStartOf(this.universe.key));
        const to = polar(angle, ARM_END);
        const dock = polar(angle, DOCK_RADIUS);
        const rad = angle * Math.PI / 180;
        const normal = {x: Math.sin(rad), y: -Math.cos(rad)}; // para baixo quando a porta fica à esquerda

        const g = svg('g', {class: 'port', 'data-busy': 'false'}, this.portLayer);
        svg('line', {x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: 'port-arm'}, g);
        svg('circle', {cx: to.x, cy: to.y, r: 7, class: 'port-light'}, g);
        const pulse = svg('circle', {cx: to.x, cy: to.y, r: 10, class: 'port-pulse'}, g);
        pulse.style.transformOrigin = `${to.x}px ${to.y}px`;

        const slot = svg('rect', {x: dock.x - 52, y: dock.y - 20, width: 104, height: 40, rx: 18, class: 'port-slot'}, g);
        slot.style.transformOrigin = `${dock.x}px ${dock.y}px`;
        slot.style.transform = `rotate(${angle - 180}deg)`;
        text('livre', {x: dock.x, y: dock.y + 4, 'text-anchor': 'middle', class: 'port-free'}, g);

        const label = polar(angle, 76);
        text(`Porta ${id}`, {
            x: label.x + normal.x * 24,
            y: label.y + normal.y * 24 + 4,
            'text-anchor': 'middle',
            class: 'port-label',
        }, g);

        return {g, pulse, angle, dock};
    }

    buildShip(ship) {
        const g = svg('g', {class: 'ship', 'data-state': 'NEW'}, this.shipLayer);
        g.style.setProperty('--ship-color', ship.color);

        const bob = svg('g', {class: 'ship-bob'}, g);
        bob.style.animationDelay = `${-(this.ships.size * 0.7)}s`;

        // Com prioridade na gravação, o casco e a situação vêm do nível de urgência da nave
        const rank = ship.priorityRank;
        const design = hullFor(this.universe, rank ?? this.ships.size);
        const context = rank === null ? null : priorityContext(this.universe, rank);

        const rot = svg('g', {class: 'ship-rot'}, bob);
        const warp = svg('g', {class: 'ship-warp'}, rot); // esticado na chegada, no efeito de salto
        svg('line', {class: 'ship-trail', x1: -60, y1: 0, x2: -230, y2: 0}, warp);
        const hull = drawHull(warp, SHIP_SCALE, design);
        svg('title', {}, hull).textContent = HULL_NAMES[design] ?? '';
        if (context?.effect) drawEffect(hull, context.effect);

        text(ship.id, {y: -30, 'text-anchor': 'middle', class: 'ship-id'}, bob);
        if (context) this.buildBadge(bob, ship, context);
        const gauge = svg('g', {transform: `translate(${-GAUGE_WIDTH / 2} 26)`}, bob);
        svg('rect', {class: 'gauge-track', width: GAUGE_WIDTH, height: 5, rx: 2.5}, gauge);
        const fill = svg('rect', {class: 'gauge-fill', width: GAUGE_WIDTH, height: 5, rx: 2.5}, gauge);
        const rest = text('', {y: 49, 'text-anchor': 'middle', class: 'ship-rest'}, bob);

        return {g, rot, fill, rest, burst: ship.burstTime};
    }

    /** Selo com o ícone da situação de prioridade, ao lado do nome da nave. */
    buildBadge(parent, ship, context) {
        const badge = svg('g', {
            class: 'ship-badge',
            'data-rank': Math.min(ship.priorityRank, 3),
            transform: 'translate(27 -36)',
        }, parent);
        svg('title', {}, badge).textContent = `Prioridade ${ship.basePriority} · ${context.label}`;
        svg('circle', {class: 'badge-pulse', r: 10}, badge);
        svg('circle', {class: 'badge-disc', r: 10}, badge);
        drawIcon(badge, context.icon);
    }

    /**
     * Posiciona tudo conforme o quadro de um tick.
     * @param animate true = as naves deslizam até a nova posição; false = saltam direto (usado ao arrastar a linha do tempo)
     */
    render(frame, animate) {
        if (!this.timeline) return;
        if (!animate) this.root.classList.add('no-anim');

        const busy = new Set();
        this.timeline.ships.forEach((ship, index) => {
            const view = this.ships.get(ship.id);
            const now = frame.ships[ship.id];
            const place = this.placeFor(now, index, frame.readyCount);

            view.g.dataset.state = now.state;
            view.g.style.transform = `translate(${place.x.toFixed(1)}px, ${place.y.toFixed(1)}px)`;
            view.rot.style.transform = `rotate(${place.angle}deg)`;
            view.fill.style.width = `${(GAUGE_WIDTH * now.remaining / view.burst).toFixed(1)}px`;
            view.rest.textContent = `resta ${now.remaining}`;
            if (now.state === 'RUNNING') busy.add(now.portId);
        });

        for (const [id, port] of this.ports) {
            port.g.dataset.busy = String(busy.has(id));
        }

        if (!animate) {
            // Força o navegador a aplicar as posições antes de religar as transições
            void this.root.getBoundingClientRect();
            this.root.classList.remove('no-anim');
            return;
        }

        for (const e of frame.events) {
            if (e.type === 'PREEMPT' && this.ports.has(String(e.portId))) {
                this.replay(this.ports.get(String(e.portId)).pulse, 'is-pulsing');
            } else if (e.type === 'ARRIVAL') {
                this.replay(this.ships.get(e.spaceCraftId).g, 'is-arriving');
            }
        }
    }

    placeFor(now, index, readyCount) {
        switch (now.state) {
            case 'READY': {
                const step = readyCount > 1 ? Math.min(28, 160 / (readyCount - 1)) : 0;
                const angle = 180 - (now.slot - (readyCount - 1) / 2) * step;
                return {...polar(angle, ORBIT.rx, ORBIT.ry), angle: 0};
            }
            case 'RUNNING': {
                const port = this.ports.get(now.portId);
                if (!port) return {x: STATION.x - DOCK_RADIUS, y: STATION.y, angle: 0};
                return {...port.dock, angle: port.angle - 180};
            }
            case 'FINISHED':
                return {x: 1090, y: 40, angle: -24};
            default: { // NEW: fora da tela, à esquerda, na altura em que vai entrar
                const count = this.timeline.ships.length;
                return {x: -90, y: STATION.y + (index - (count - 1) / 2) * 70, angle: 0};
            }
        }
    }

    /** Dispara de novo uma animação CSS, mesmo que a classe já esteja no elemento. */
    replay(node, className) {
        node.classList.remove(className);
        void node.getBoundingClientRect();
        node.classList.add(className);
    }
}
