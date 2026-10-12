// Fundo e estação de cada universo, usados pelas duas cenas (área de 1000 × 500).
// A estação tem duas partes: o corpo, que fica por baixo de tudo, e o centro (hub), de onde saem portas e braços.
// No sincronismo o centro é desenhado por cima dos braços, por isso as duas partes são separadas.

import {svg, seeded} from './svg.js';

const path = (g, className, d) => svg('path', {class: className, d}, g);
const rect = (g, className, x, y, width, height, rx = 0) => svg('rect', {class: className, x, y, width, height, rx}, g);
const circle = (g, className, cx, cy, r) => svg('circle', {class: className, cx, cy, r}, g);
const line = (g, className, x1, y1, x2, y2) => svg('line', {class: className, x1, y1, x2, y2}, g);
const points = list => list.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
const polygon = (g, className, list) => svg('polygon', {class: className, points: points(list)}, g);

// ---------- fundo ----------

const PLANET = {x: 955, y: 640, r: 270};

function planet(sky) {
    circle(sky, 'planet', PLANET.x, PLANET.y, PLANET.r);
    circle(sky, 'planet-rim', PLANET.x, PLANET.y, PLANET.r);
}

/** Grupo recortado no contorno de um círculo, para desenhar a superfície de um planeta. */
function clipped(sky, id, cx, cy, r) {
    const clip = svg('clipPath', {id}, svg('defs', {}, sky));
    svg('circle', {cx, cy, r}, clip);
    return svg('g', {'clip-path': `url(#${id})`}, sky);
}

const SKIES = {
    padrao: planet,

    /** Planeta desértico e dois sóis. */
    starwars(sky) {
        circle(sky, 'sun sun-a', 820, 58, 19);
        circle(sky, 'sun sun-b', 868, 90, 12);
        planet(sky);
    },

    /** O anel Halo atravessa o fundo: a metade de trás é fina e a da frente mostra a face habitada. */
    halo(sky) {
        path(sky, 'ring-far', 'M285.9 347.1 A430 118 -20 0 1 1094.1 52.9');
        planet(sky);
        path(sky, 'ring-near', 'M285.9 347.1 A430 118 -20 0 0 1094.1 52.9');
        path(sky, 'ring-land', 'M285.9 347.1 A430 118 -20 0 0 1094.1 52.9');
    },

    /** A Terra, com continentes e nuvens. */
    real(sky) {
        circle(sky, 'planet', PLANET.x, PLANET.y, PLANET.r);
        const surface = clipped(sky, 'sky-earth', PLANET.x, PLANET.y, PLANET.r);
        path(surface, 'continent', 'M786 500 C800 462 838 440 872 446 C898 452 890 478 908 500 Z');
        path(surface, 'continent', 'M926 398 C950 384 986 390 1000 408 V452 C974 450 952 440 942 420 Z');
        path(surface, 'cloud', 'M760 494 C795 478 838 478 866 468 M896 430 C925 420 960 426 992 438 M850 420 C870 410 892 408 912 412');
        circle(sky, 'planet-rim', PLANET.x, PLANET.y, PLANET.r);
        circle(sky, 'atmosphere', PLANET.x, PLANET.y, PLANET.r + 5);
    },

    /** Gigante gasoso com faixas, como o que a Sevastopol orbita. */
    alien(sky) {
        const giant = {x: 900, y: 720, r: 360};
        circle(sky, 'planet', giant.x, giant.y, giant.r);
        const surface = svg('g', {transform: 'rotate(-7 900 430)'}, clipped(sky, 'sky-giant', giant.x, giant.y, giant.r));
        [[372, 14, 'a'], [398, 22, 'b'], [432, 10, 'a'], [452, 26, 'b'], [488, 16, 'a']].forEach(([y, height, kind]) => {
            rect(surface, `band band-${kind}`, 480, y, 640, height);
        });
        circle(sky, 'planet-rim', giant.x, giant.y, giant.r);
    },
};

/** Estrelas e os astros do universo. As estrelas vêm de uma semente fixa, para o céu ser sempre o mesmo. */
export function drawSky(root, universeKey) {
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
    (SKIES[universeKey] ?? SKIES.padrao)(sky);
    return sky;
}

// ---------- estações ----------

function spinningRing(g, x, y) {
    const ring = circle(g, 'hub-ring', x, y, 60);
    ring.style.transformOrigin = `${x}px ${y}px`;
}

function roundHub(g, x, y, radius = 46, core = 26, light = 8) {
    circle(g, 'hub', x, y, radius);
    circle(g, 'hub-core', x, y, core);
    circle(g, 'hub-light', x, y, light);
}

function solarPanel(g, left, top, width, columns) {
    rect(g, 'solar', left, top, width, 48, 3);
    for (let i = 1; i < columns; i++) {
        const x = left + i * width / columns;
        line(g, 'solar-grid', x, top, x, top + 48);
    }
    line(g, 'solar-grid', left, top + 24, left + width, top + 24);
}

/**
 * armStart: distância do centro em que as portas de acoplamento começam (a borda do centro da estação).
 * body(g, x, y, side): side = true na cena de sincronismo, em que a estação fica encostada na direita.
 */
const STATIONS = {

    padrao: {
        armStart: 46,
        body(g, x, y, side) {
            for (const dir of [-1, 1]) {
                if (side) {
                    line(g, 'station-strut', x + 30, y + dir * 40, x + 62, y + dir * 96);
                    solarPanel(g, x + 26, dir < 0 ? y - 144 : y + 96, 80, 4);
                } else {
                    line(g, 'station-strut', x, y + dir * 46, x, y + dir * 84);
                    solarPanel(g, x - 46, dir < 0 ? y - 132 : y + 84, 92, 4);
                }
            }
            if (!side) {
                rect(g, 'station-module', x + 40, y - 15, 62, 30, 6);
                line(g, 'station-strut', x + 102, y, x + 128, y);
                circle(g, 'station-dish', x + 136, y, 9);
            }
            spinningRing(g, x, y);
        },
        hub: roundHub,
    },

    /** Estrela da Morte: esfera com a trincheira no equador e o disco do superlaser. */
    starwars: {
        armStart: 86,
        body(g, x, y) {
            const r = 86;
            circle(g, 'ds-sphere', x, y, r);
            for (const dy of [-62, -34, 34, 62]) {
                const half = Math.sqrt(r * r - dy * dy);
                path(g, 'ds-line', `M${(x - half).toFixed(1)} ${y + dy} Q${x} ${y + dy + 7} ${(x + half).toFixed(1)} ${y + dy}`);
            }
            const random = seeded(11);
            for (let i = 0; i < 26; i++) {
                const angle = random() * Math.PI * 2;
                const distance = 14 + random() * 64;
                rect(g, 'ds-light', x + distance * Math.cos(angle), y + distance * Math.sin(angle), 2.6, 1.4);
            }
            path(g, 'ds-trench', `M${x - r} ${y - 3} Q${x} ${y + 4} ${x + r} ${y - 3} M${x - r} ${y + 3} Q${x} ${y + 10} ${x + r} ${y + 3}`);
            circle(g, 'ds-dish', x - 30, y - 42, 21);
            circle(g, 'ds-dish-inner', x - 30, y - 42, 10);
            circle(g, 'ds-dish-core', x - 30, y - 42, 2.8);
            // Sombra em crescente no lado direito, para a esfera ganhar volume
            path(g, 'ds-shade', `M${x} ${y - r} A${r} ${r} 0 0 1 ${x} ${y + r} A${r * 0.45} ${r} 0 0 0 ${x} ${y - r} Z`);
        },
        hub(g, x, y) {
            roundHub(g, x, y, 22, 13, 5);
        },
    },

    /** Estrutura Forerunner: torres angulosas, peças soltas e frestas de luz. */
    halo: {
        armStart: 42,
        body(g, x, y) {
            for (const dir of [-1, 1]) {
                polygon(g, 'fr-plate', [[x - 15, y + dir * 40], [x + 15, y + dir * 40], [x + 7, y + dir * 132], [x - 1, y + dir * 150], [x - 9, y + dir * 128]]);
                line(g, 'fr-glow', x, y + dir * 52, x + 1, y + dir * 122);
                polygon(g, 'fr-plate', [[x + 17, y + dir * 116], [x + 27, y + dir * 110], [x + 23, y + dir * 141]]);
                polygon(g, 'fr-plate', [[x + 38, y + dir * 14], [x + 112, y + dir * 42], [x + 126, y + dir * 31], [x + 64, y + dir * 4]]);
                line(g, 'fr-glow', x + 56, y + dir * 13, x + 112, y + dir * 34);
            }
            polygon(g, 'fr-plate', [[x + 40, y - 5], [x + 132, y - 2], [x + 132, y + 2], [x + 40, y + 5]]);
            circle(g, 'fr-beacon', x + 137, y, 3.2);
            spinningRing(g, x, y);
        },
        hub(g, x, y) {
            const octagon = radius => Array.from({length: 8}, (_, i) => {
                const angle = (22.5 + i * 45) * Math.PI / 180;
                return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
            });
            polygon(g, 'hub', octagon(46));
            polygon(g, 'hub-core', octagon(27));
            circle(g, 'hub-light', x, y, 8);
        },
    },

    /** ISS: a treliça comprida com os painéis solares nas pontas e os módulos habitados no meio. */
    real: {
        armStart: 38,
        body(g, x, y) {
            rect(g, 'iss-truss', x - 4, y - 152, 8, 304);
            for (let dy = -144; dy <= 144; dy += 16) line(g, 'iss-lattice', x - 4, y + dy, x + 4, y + dy + 8);
            for (const dir of [-1, 1]) {
                for (const row of [0, 1]) {
                    const top = y + dir * (150 - row * 30) - 10;
                    for (const left of [x - 52, x + 8]) {
                        for (const strip of [0, 12]) {
                            rect(g, 'solar', left, top + strip, 44, 8, 1);
                            for (let i = 1; i < 4; i++) line(g, 'solar-grid', left + i * 11, top + strip, left + i * 11, top + strip + 8);
                        }
                    }
                }
                rect(g, 'iss-radiator', x + 8, y + dir * 76 - 10, 36, 20, 1);
                for (let i = 1; i < 4; i++) line(g, 'iss-seam', x + 8 + i * 9, y + dir * 76 - 10, x + 8 + i * 9, y + dir * 76 + 10);
            }
            rect(g, 'station-module', x + 70, y - 46, 20, 92, 9);
            rect(g, 'station-module', x + 28, y - 12, 100, 24, 11);
            for (const dx of [54, 106]) line(g, 'iss-seam', x + dx, y - 12, x + dx, y + 12);
            rect(g, 'station-module', x + 128, y - 7, 15, 14, 5);
        },
        hub(g, x, y) {
            rect(g, 'hub', x - 38, y - 38, 76, 76, 20);
            rect(g, 'hub-core', x - 22, y - 22, 44, 44, 11);
            circle(g, 'hub-light', x, y, 8);
        },
    },

    /** Sevastopol: três torres escuras ligadas por passarelas, com poucas janelas acesas. */
    alien: {
        armStart: 40,
        body(g, x, y) {
            const towers = [{dx: 0, top: -152, bottom: 152}, {dx: 54, top: -122, bottom: 126}, {dx: 108, top: -98, bottom: 104}];
            rect(g, 'sev-bridge', x + 6, y - 76, 108, 8, 1);
            rect(g, 'sev-bridge', x + 6, y + 72, 108, 8, 1);
            rect(g, 'sev-bridge', x - 6, y - 13, 128, 26, 3);
            const random = seeded(23);
            for (const {dx, top, bottom} of towers) {
                const cx = x + dx;
                line(g, 'sev-mast', cx, y + top, cx, y + top - 16);
                path(g, 'sev-tower', `M${cx - 14} ${y + top + 14} L${cx - 8} ${y + top} H${cx + 8} L${cx + 14} ${y + top + 14} `
                    + `V${y + bottom - 14} L${cx + 8} ${y + bottom} H${cx - 8} L${cx - 14} ${y + bottom - 14} Z`);
                line(g, 'sev-seam', cx, y + top + 16, cx, y + bottom - 16);
                for (let i = 0; i < 9; i++) {
                    const wx = cx - 10 + Math.floor(random() * 5) * 4.5;
                    const wy = y + top + 22 + random() * (bottom - top - 48);
                    rect(g, 'sev-window', wx, wy, 3, 2);
                }
            }
        },
        hub(g, x, y) {
            rect(g, 'hub', x - 40, y - 32, 80, 64, 6);
            path(g, 'sev-hazard', `M${x - 40} ${y - 24} H${x + 40} M${x - 40} ${y + 24} H${x + 40}`);
            rect(g, 'hub-core', x - 24, y - 17, 48, 34, 4);
            circle(g, 'hub-light', x, y, 7);
        },
    },
};

const stationOf = universeKey => STATIONS[universeKey] ?? STATIONS.padrao;

/** Corpo da estação, centrado em (x, y). */
export function drawStationBody(g, universeKey, x, y, side = false) {
    stationOf(universeKey).body(g, x, y, side);
}

/** Centro da estação, de onde saem as portas e os braços. */
export function drawStationHub(g, universeKey, x, y) {
    stationOf(universeKey).hub(g, x, y);
}

/** Distância do centro em que começam as portas de acoplamento. */
export function armStartOf(universeKey) {
    return stationOf(universeKey).armStart;
}
