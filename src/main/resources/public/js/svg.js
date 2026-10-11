// Peças de SVG usadas pelas duas cenas: criação de elementos, céu de fundo e o casco das naves.

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

/** Gerador pseudoaleatório com semente, para o céu ser sempre o mesmo. */
function seeded(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Estrelas e o planeta ao fundo, para uma área de 1000 × 500. */
export function drawSky(root) {
    const sky = svg('g', {class: 'sky', 'aria-hidden': 'true'}, root);
    const random = seeded(7);
    for (let i = 0; i < 120; i++) {
        const star = svg('circle', {
            cx: (random() * 1000).toFixed(1),
            cy: (random() * 500).toFixed(1),
            r: (0.4 + random() * 1.1).toFixed(2),
            class: i % 9 === 0 ? 'star twinkle' : 'star',
        }, sky);
        star.style.opacity = (0.25 + random() * 0.6).toFixed(2);
        star.style.animationDelay = `${(random() * 4).toFixed(1)}s`;
    }
    svg('circle', {cx: 955, cy: 640, r: 270, class: 'planet'}, sky);
    svg('circle', {cx: 955, cy: 640, r: 270, class: 'planet-rim'}, sky);
    return sky;
}

/** Casco da nave, centrado na origem e apontando para a direita. A cor vem de --ship-color. */
export function drawHull(parent, scale) {
    const hull = svg('g', {transform: `scale(${scale})`}, parent);
    svg('path', {class: 'ship-fins', d: 'M-30 -11 L-41 -20 L-17 -11 Z M-30 11 L-41 20 L-17 11 Z'}, hull);
    svg('rect', {class: 'ship-engine', x: -36, y: -7, width: 7, height: 14, rx: 2}, hull);
    svg('path', {class: 'ship-hull', d: 'M-30 -11 H8 C24 -11 34 -4 36 0 C34 4 24 11 8 11 H-30 Z'}, hull);
    svg('path', {class: 'ship-stripe', d: 'M-9 -11 V11'}, hull);
    svg('circle', {class: 'ship-window', cx: 13, cy: 0, r: 4.5}, hull);
    return hull;
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
