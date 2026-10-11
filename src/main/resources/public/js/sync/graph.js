// Grafo de alocação de recursos, na notação dos livros de SO:
// círculo = processo (nave), quadrado = recurso (braço).
// Seta cheia do recurso para a nave = o recurso está com ela. Seta tracejada da nave para o recurso = ela está esperando.
// Um ciclo nesse grafo é um deadlock.

import {svg, text, arrow} from '../svg.js';
import {resourceLabel, resourceShort, isPool} from './model.js';

const WIDTH = 360;
const SHIP_Y = 46;
const RESOURCE_Y = 150;
const SHIP_RADIUS = 20;
const SMALL_RADIUS = 17; // com muitas naves
const BOX = 40;

export class WaitGraph {

    constructor(root) {
        this.root = root;
    }

    render(state) {
        this.root.replaceChildren();
        const shipX = new Map(state.ships.map((s, i) => [s.id, WIDTH * (i + 1) / (state.ships.length + 1)]));
        const resourceX = new Map(state.resources.map((r, i) => [r.id, WIDTH * (i + 1) / (state.resources.length + 1)]));
        const top = RESOURCE_Y - BOX / 2;
        const radius = state.ships.length > 4 ? SMALL_RADIUS : SHIP_RADIUS;
        const bottom = SHIP_Y + radius;

        const edges = svg('g', {}, this.root);
        for (const ship of state.ships) {
            const stuck = state.deadlock.includes(ship.id);
            for (const id of ship.holds) {
                if (!resourceX.has(id)) continue;
                const edge = arrow(edges, resourceX.get(id) - 7, top - 2, shipX.get(ship.id) - 7, bottom + 3,
                    stuck ? 'edge edge-hold is-deadlock' : 'edge edge-hold');
                edge.style.color = ship.color;
            }
            if (ship.waitsFor !== null && resourceX.has(ship.waitsFor)) {
                const edge = arrow(edges, shipX.get(ship.id) + 7, bottom + 2, resourceX.get(ship.waitsFor) + 7, top - 3,
                    stuck ? 'edge edge-wait is-deadlock' : 'edge edge-wait');
                edge.style.color = ship.color;
            }
        }

        for (const ship of state.ships) {
            const g = svg('g', {class: ship.done ? 'graph-ship is-done' : 'graph-ship'}, this.root);
            const circle = svg('circle', {cx: shipX.get(ship.id), cy: SHIP_Y, r: radius}, g);
            circle.style.stroke = ship.color;
            text(ship.id, {x: shipX.get(ship.id), y: SHIP_Y + 5, 'text-anchor': 'middle'}, g);
        }

        for (const resource of state.resources) {
            const x = resourceX.get(resource.id);
            const g = svg('g', {class: 'graph-resource'}, this.root);
            // Notação dos livros: um ponto por unidade do recurso; um braço nomeado mostra a letra
            const letter = resourceShort(resource.id);
            const width = letter ? BOX : Math.max(BOX, 18 * resource.capacity + 14);
            svg('rect', {x: x - width / 2, y: top, width, height: BOX, rx: 6}, g);
            if (letter) {
                text(letter, {x, y: RESOURCE_Y + 5, 'text-anchor': 'middle'}, g);
            } else {
                for (let unit = 0; unit < resource.capacity; unit++) {
                    svg('circle', {cx: x + (unit - (resource.capacity - 1) / 2) * 18, cy: RESOURCE_Y, r: 5, class: 'graph-unit'}, g);
                }
            }
            const caption = isPool(resource) ? `${resource.capacity} ${resourceLabel(resource.id, resource.capacity)}` : resourceLabel(resource.id);
            text(caption, {x, y: RESOURCE_Y + BOX / 2 + 18, 'text-anchor': 'middle', class: 'graph-caption'}, g);
        }
    }
}
