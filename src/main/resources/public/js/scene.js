// Cena da estação em SVG: órbita de espera (fila de prontos), portas (núcleos de CPU) e naves (processos).

import {svg, text, drawSky, drawHull} from './svg.js';

const STATION = {x: 610, y: 250};
const ORBIT = {rx: 335, ry: 195};
const HUB_RADIUS = 46;
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

    constructor(root) {
        this.root = root;
        this.timeline = null;
        this.ships = new Map();
        this.ports = new Map();

        this.buildBackdrop();
        this.buildStation();
        this.portLayer = svg('g', {class: 'ports'}, this.root);
        this.shipLayer = svg('g', {class: 'ships'}, this.root);
    }

    buildBackdrop() {
        drawSky(this.root);

        const orbit = svg('g', {class: 'orbit'}, this.root);
        svg('ellipse', {cx: STATION.x, cy: STATION.y, rx: ORBIT.rx, ry: ORBIT.ry, class: 'orbit-ring'}, orbit);
        text('Órbita de espera', {x: 150, y: 44, class: 'scene-label'}, orbit);
        text('fila de prontos · READY', {x: 150, y: 62, class: 'scene-sublabel'}, orbit);

        const legend = svg('g', {class: 'scene-legend'}, this.root);
        text('porta de acoplamento = núcleo de CPU', {x: 18, y: 462}, legend);
        text('recuo da porta = preempção (troca de contexto)', {x: 18, y: 482}, legend);
        text('partidas', {x: 982, y: 30, 'text-anchor': 'end', class: 'scene-sublabel'}, this.root);
    }

    buildStation() {
        const g = svg('g', {class: 'station', 'aria-hidden': 'true'}, this.root);
        const {x, y} = STATION;

        // Painéis solares, em cima e embaixo
        for (const dir of [-1, 1]) {
            svg('line', {x1: x, y1: y + dir * HUB_RADIUS, x2: x, y2: y + dir * 84, class: 'station-strut'}, g);
            const top = dir < 0 ? y - 132 : y + 84;
            svg('rect', {x: x - 46, y: top, width: 92, height: 48, rx: 3, class: 'solar'}, g);
            for (let i = 1; i < 4; i++) {
                svg('line', {x1: x - 46 + i * 23, y1: top, x2: x - 46 + i * 23, y2: top + 48, class: 'solar-grid'}, g);
            }
            svg('line', {x1: x - 46, y1: top + 24, x2: x + 46, y2: top + 24, class: 'solar-grid'}, g);
        }

        // Módulo e antena, à direita
        svg('rect', {x: x + 40, y: y - 15, width: 62, height: 30, rx: 6, class: 'station-module'}, g);
        svg('line', {x1: x + 102, y1: y, x2: x + 128, y2: y, class: 'station-strut'}, g);
        svg('circle', {cx: x + 136, cy: y, r: 9, class: 'station-dish'}, g);

        const ring = svg('circle', {cx: x, cy: y, r: 60, class: 'hub-ring'}, g);
        ring.style.transformOrigin = `${x}px ${y}px`;
        svg('circle', {cx: x, cy: y, r: HUB_RADIUS, class: 'hub'}, g);
        svg('circle', {cx: x, cy: y, r: 26, class: 'hub-core'}, g);
        svg('circle', {cx: x, cy: y, r: 8, class: 'hub-light'}, g);
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
        const from = polar(angle, HUB_RADIUS);
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

        const rot = svg('g', {class: 'ship-rot'}, bob);
        drawHull(rot, SHIP_SCALE);

        text(ship.id, {y: -30, 'text-anchor': 'middle', class: 'ship-id'}, bob);
        const gauge = svg('g', {transform: `translate(${-GAUGE_WIDTH / 2} 26)`}, bob);
        svg('rect', {class: 'gauge-track', width: GAUGE_WIDTH, height: 5, rx: 2.5}, gauge);
        const fill = svg('rect', {class: 'gauge-fill', width: GAUGE_WIDTH, height: 5, rx: 2.5}, gauge);
        const rest = text('', {y: 49, 'text-anchor': 'middle', class: 'ship-rest'}, bob);

        return {g, rot, fill, rest, burst: ship.burstTime};
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
                this.pulse(this.ports.get(String(e.portId)));
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

    pulse(port) {
        port.pulse.classList.remove('is-pulsing');
        void port.pulse.getBoundingClientRect();
        port.pulse.classList.add('is-pulsing');
    }
}
