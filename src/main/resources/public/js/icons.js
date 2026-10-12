// Ícones pequenos das situações de prioridade. Cada um cabe em um quadrado de 16 × 16 centrado na origem.

import {svg} from './svg.js';

// [elemento, atributos, 'fill' ou 'stroke']
const ICONS = {
    medical: [
        ['path', {d: 'M-1.8 -5.5 H1.8 V-1.8 H5.5 V1.8 H1.8 V5.5 H-1.8 V1.8 H-5.5 V-1.8 H-1.8 Z'}, 'fill'],
    ],
    damage: [
        ['path', {d: 'M1.8 -6 L-3.8 0.9 H-0.4 L-1.8 6 L3.8 -0.9 H0.4 Z'}, 'fill'],
    ],
    biohazard: [
        ['circle', {cx: 0, cy: -2.7, r: 2.7}, 'stroke'],
        ['circle', {cx: 2.4, cy: 1.4, r: 2.7}, 'stroke'],
        ['circle', {cx: -2.4, cy: 1.4, r: 2.7}, 'stroke'],
        ['circle', {cx: 0, cy: 0, r: 1.2}, 'fill'],
    ],
    alert: [
        ['path', {d: 'M0 -5.5 L5.8 4.6 H-5.8 Z'}, 'stroke'],
        ['path', {d: 'M0 -1.8 V1.4'}, 'stroke'],
        ['circle', {cx: 0, cy: 3, r: 0.7}, 'fill'],
    ],
    crew: [
        ['circle', {cx: 0, cy: -2.6, r: 2.3}, 'fill'],
        ['path', {d: 'M-4.6 5.2 C-4.6 0.6 4.6 0.6 4.6 5.2 Z'}, 'fill'],
    ],
    crate: [
        ['rect', {x: -4.6, y: -4.6, width: 9.2, height: 9.2, rx: 1}, 'stroke'],
        ['path', {d: 'M-4.6 -1.4 H4.6 M0 -4.6 V-1.4'}, 'stroke'],
    ],
    star: [
        ['path', {d: 'M0 -5.8 L1.6 -1.8 L5.8 -1.6 L2.5 1.1 L3.6 5.3 L0 3 L-3.6 5.3 L-2.5 1.1 L-5.8 -1.6 L-1.6 -1.8 Z'}, 'fill'],
    ],
    shield: [
        ['path', {d: 'M0 -5.6 L4.8 -3.4 V0.6 C4.8 3.2 2.6 4.9 0 5.8 C-2.6 4.9 -4.8 3.2 -4.8 0.6 V-3.4 Z'}, 'stroke'],
        ['path', {d: 'M0 -2.6 V2.6'}, 'stroke'],
    ],
    engram: [
        ['path', {d: 'M0 -5.8 L5 -2.9 V2.9 L0 5.8 L-5 2.9 V-2.9 Z'}, 'stroke'],
        ['path', {d: 'M0 0 V5.8 M0 0 L5 -2.9 M0 0 L-5 -2.9'}, 'stroke'],
    ],
    patrol: [
        ['path', {d: 'M-4.6 -3.6 L-0.4 0 L-4.6 3.6 M0.4 -3.6 L4.6 0 L0.4 3.6'}, 'stroke'],
    ],
};

function drawInto(parent, name) {
    for (const [tag, attrs, kind] of ICONS[name] ?? ICONS.alert) {
        svg(tag, {...attrs, class: `icon-${kind}`}, parent);
    }
}

/** Ícone dentro de uma cena SVG. A cor vem de currentColor. */
export function drawIcon(parent, name) {
    const g = svg('g', {class: 'icon'}, parent);
    drawInto(g, name);
    return g;
}

/** Ícone solto, para usar no meio do HTML (tabelas e legendas). */
export function iconElement(name) {
    const root = svg('svg', {class: 'icon', viewBox: '-8 -8 16 16', 'aria-hidden': 'true'});
    drawInto(root, name);
    return root;
}
