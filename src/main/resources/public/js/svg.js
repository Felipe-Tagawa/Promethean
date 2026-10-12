// Peças básicas de SVG usadas pelas duas cenas: criação de elementos, setas e o gerador com semente.
// As naves ficam em hulls.js; o céu e as estações, em stations.js.

const NS = 'http://www.w3.org/2000/svg';

export function svg(name, attrs = {}, parent = null) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (parent) parent.append(node);
    return node;
}

export function text(content, attrs, parent) {
    const node = svg('text', attrs, parent);
    node.textContent = content;
    return node;
}

/** Gerador pseudoaleatório com semente: o mesmo número de partida dá sempre o mesmo desenho. */
export function seeded(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Linha com ponta de seta, do ponto 1 ao ponto 2. A cor vem de currentColor. */
export function arrow(parent, x1, y1, x2, y2, className) {
    const size = 9;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const g = svg('g', {class: className}, parent);
    // A linha para um pouco antes, para não aparecer por baixo da ponta
    svg('line', {x1, y1, x2: (x2 - cos * size * 0.7).toFixed(1), y2: (y2 - sin * size * 0.7).toFixed(1)}, g);
    const base = {x: x2 - cos * size, y: y2 - sin * size};
    const points = [
        [x2, y2],
        [base.x + sin * size * 0.5, base.y - cos * size * 0.5],
        [base.x - sin * size * 0.5, base.y + cos * size * 0.5],
    ];
    svg('polygon', {points: points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}, g);
    return g;
}
