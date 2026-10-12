// Cascos das naves. Todos são centrados na origem, apontam para a direita e cabem em x de -41 a 37 e y de -20 a 20,
// que é a caixa do casco original: as duas cenas calculam posições e rótulos contando com esse tamanho.
// As cores vêm do CSS: --ship-color é a cor da nave e --glow a dos motores.

import {svg} from './svg.js';

const path = (hull, className, d) => svg('path', {class: className, d}, hull);
const rect = (hull, className, x, y, width, height, rx = 0) => svg('rect', {class: className, x, y, width, height, rx}, hull);
const circle = (hull, className, cx, cy, r) => svg('circle', {class: className, cx, cy, r}, hull);
const ellipse = (hull, className, cx, cy, rx, ry) => svg('ellipse', {class: className, cx, cy, rx, ry}, hull);

/** Desenha a mesma peça dos dois lados do eixo da nave. */
function mirrored(hull, draw) {
    draw(hull);
    draw(svg('g', {transform: 'scale(1 -1)'}, hull));
}

const HULLS = {

    // ---------- Padrão ----------

    classic(hull) {
        path(hull, 'ship-fins', 'M-30 -11 L-41 -20 L-17 -11 Z M-30 11 L-41 20 L-17 11 Z');
        rect(hull, 'ship-engine', -36, -7, 7, 14, 2);
        path(hull, 'ship-hull', 'M-30 -11 H8 C24 -11 34 -4 36 0 C34 4 24 11 8 11 H-30 Z');
        path(hull, 'ship-stripe', 'M-9 -11 V11');
        circle(hull, 'ship-window', 13, 0, 4.5);
    },

    // ---------- Star Wars ----------

    /** Disco com duas mandíbulas à frente e a cabine deslocada para o lado. */
    falcon(hull) {
        path(hull, 'ship-glow-line', 'M-25.5 -9 A19 19 0 0 0 -25.5 9');
        mirrored(hull, g => path(g, 'ship-hull', 'M2 -14 L33 -8.5 L35 -3 L8 -2.6 Z'));
        path(hull, 'ship-hull', 'M-4 10 L13 14.5 L21 15 L23 11 L16 8.5 L4 5 Z');
        circle(hull, 'ship-hull', -8, 0, 18);
        path(hull, 'ship-line', 'M-8 -18 V-7 M-8 7 V18 M-26 0 H-15 M-1 0 H10 M-20.5 -12.5 L-13 -5 M-20.5 12.5 L-13 5');
        circle(hull, 'ship-window', -8, 0, 5.5);
        circle(hull, 'ship-light', -15, -11, 3.4);
        circle(hull, 'ship-window', 19.5, 12.2, 2.2);
        for (const y of [-5, 0, 5]) circle(hull, 'ship-engine', -22, y, 1.5);
    },

    /** Caça com quatro asas em X, vistas de cima, e os canhões nas pontas. */
    xwing(hull) {
        mirrored(hull, g => {
            path(g, 'ship-fins', 'M-8 -3.5 L-24 -3.5 L-29 -18.5 L-21 -18.5 Z');
            path(g, 'ship-cannon', 'M-29 -19 H8');
            rect(g, 'ship-engine', -30, -10.5, 13, 5, 2.2);
            circle(g, 'ship-glow', -31, -8, 1.9);
        });
        path(hull, 'ship-hull', 'M36 0 L12 -3.6 L-22 -4.8 L-29 -3 V3 L-22 4.8 L12 3.6 Z');
        path(hull, 'ship-stripe', 'M-14 -4.6 V4.6');
        ellipse(hull, 'ship-window', 3, 0, 5.5, 2.3);
        circle(hull, 'ship-light', -8, 0, 1.9);
    },

    /** Cunha comprida, com a torre da ponte de comando atrás. */
    destroyer(hull) {
        for (const y of [-9, 0, 9]) circle(hull, 'ship-glow', -38.5, y, 2.6);
        path(hull, 'ship-hull', 'M37 0 L-33 -19 L-38 -15 V15 L-33 19 Z');
        path(hull, 'ship-fins', 'M12 0 L-29 -9 V9 Z');
        path(hull, 'ship-line', 'M34 0 H12 M-6 -14 L-30 -15 M-6 14 L-30 15');
        rect(hull, 'ship-dark', -33, -10, 6, 20, 1.2);
        mirrored(hull, g => circle(g, 'ship-light', -30, -6.5, 1.9));
    },

    /** Cabine esférica entre dois painéis, vistos de cima. Os motores são vermelhos. */
    tie(hull) {
        hull.style.setProperty('--glow', '#ff6a5c');
        mirrored(hull, g => {
            path(g, 'ship-fins', 'M-3.5 -14 H3.5 L5.5 -6 H-5.5 Z');
            rect(g, 'ship-dark', -22, -18.5, 44, 5, 1.2);
            path(g, 'ship-line', 'M-11 -18.5 V-13.5 M0 -18.5 V-13.5 M11 -18.5 V-13.5');
        });
        mirrored(hull, g => circle(g, 'ship-glow', -8.6, -2.6, 1.4));
        circle(hull, 'ship-hull', 0, 0, 8.5);
        circle(hull, 'ship-window', 3, 0, 4.2);
        path(hull, 'ship-line', 'M3 -4.2 V4.2 M-1.2 0 H7.2');
    },

    // ---------- Halo ----------

    /** Fragata da UNSC de lado: proa dividida em duas e o bloco dos motores atrás. */
    frigate(hull) {
        mirrored(hull, g => rect(g, 'ship-glow', -42.5, -9, 3.5, 6, 1));
        path(hull, 'ship-fins', 'M-39 -13 H-20 L-15 -7 V8 L-20 14 H-39 Z');
        path(hull, 'ship-hull', 'M-22 -6.5 H14 L20 -3 V3 L14 6.5 H-22 Z');
        path(hull, 'ship-hull', 'M10 -10.5 H33 L37 -7.5 V-4 H10 Z');
        path(hull, 'ship-hull', 'M6 4 H29 L33 7 V10.5 H6 Z');
        rect(hull, 'ship-fins', -13, -11.5, 12, 5, 1.2);
        path(hull, 'ship-stripe', 'M-22 0 H12');
        path(hull, 'ship-cannon', 'M14 0 H31');
        path(hull, 'ship-line', 'M-31 -13 V14 M-10 -9 H-4');
    },

    /** Nave de transporte vista de cima: quatro motores em braços curtos. */
    pelican(hull) {
        mirrored(hull, g => {
            path(g, 'ship-fins', 'M3 -7.5 H14 L13 -12 H5 Z');
            rect(g, 'ship-engine', 0, -19, 17, 7.5, 3);
            circle(g, 'ship-glow', -1, -15.2, 1.8);
            path(g, 'ship-fins', 'M-33 -3 H-26 L-27 -8 H-32 Z');
            rect(g, 'ship-engine', -39, -14, 12, 6.5, 2.6);
            circle(g, 'ship-glow', -40, -10.8, 1.7);
        });
        path(hull, 'ship-hull', 'M31 0 C31 -6 23 -8.5 14 -8.5 L-4 -6.5 L-35 -3.2 V3.2 L-4 6.5 L14 8.5 C23 8.5 31 6 31 0 Z');
        path(hull, 'ship-stripe', 'M-4 -6.5 V6.5');
        ellipse(hull, 'ship-window', 21, 0, 6, 4.2);
    },

    /** Cruzador do Covenant: corpo arredondado, pescoço fino e luzes roxas. */
    covenant(hull) {
        hull.style.setProperty('--glow', '#c79bff');
        ellipse(hull, 'ship-glow', -39.5, 0, 2.4, 5);
        path(hull, 'ship-hull', 'M37 0 C33 -11 15 -14 5 -7 C-1 -3.5 -7 -4 -13 -9 C-23 -17 -38 -13 -40 -2 '
            + 'C-40 5 -34 13 -22 12 C-14 11 -8 5.5 -2 5.5 C7 6 14 12 26 9.5 C32 8 36 4 37 0 Z');
        path(hull, 'ship-fins', 'M30 -1 C24 -7 14 -8 8 -3 C14 -1 22 0 30 -1 Z');
        path(hull, 'ship-glow-line', 'M-33 5 C-24 4 -14 1 -4 1.5 C6 2 14 6 24 5');
        circle(hull, 'ship-glow', 21, -3.5, 1.6);
        circle(hull, 'ship-glow', -27, -5, 1.6);
    },

    /** Nave Promethean: peças angulosas soltas, unidas por luz sólida alaranjada. */
    promethean(hull) {
        hull.style.setProperty('--glow', '#ffa94d');
        mirrored(hull, g => {
            path(g, 'ship-glow-line', 'M12 -6 L-22 -11');
            path(g, 'ship-fins', 'M24 -8.5 L-28 -19 L-39 -13 L-10 -7.5 Z');
        });
        path(hull, 'ship-hull', 'M36 0 L6 -5.5 L-20 0 L6 5.5 Z');
        path(hull, 'ship-dark', 'M-24 0 L-34 -4.5 L-40 0 L-34 4.5 Z');
        circle(hull, 'ship-glow', 5, 0, 2.6);
    },

    // ---------- Real ----------

    /** Soyuz: módulo orbital redondo, cápsula em sino e módulo de serviço com dois painéis solares. */
    soyuz(hull) {
        mirrored(hull, g => {
            rect(g, 'ship-dark', -19, -20, 15, 11, 0.8);
            path(g, 'ship-line', 'M-14 -20 V-9 M-9 -20 V-9 M-19 -14.5 H-4');
        });
        rect(hull, 'ship-engine', -28, -4.5, 6, 9, 1);
        rect(hull, 'ship-hull', -23, -8.5, 29, 17, 2);
        path(hull, 'ship-fins', 'M6 -9 L17 -6 V6 L6 9 Z');
        path(hull, 'ship-cannon', 'M32 0 H37');
        circle(hull, 'ship-hull', 24, 0, 8);
        circle(hull, 'ship-window', 24, 0, 2.6);
        path(hull, 'ship-stripe', 'M-12 -8.5 V8.5');
    },

    /** Cápsula tripulada com o tronco de carga atrás. */
    dragon(hull) {
        mirrored(hull, g => path(g, 'ship-fins', 'M-24 -11 L-34 -18 L-31 -11 Z'));
        rect(hull, 'ship-fins', -26, -11.5, 30, 23, 1.5);
        rect(hull, 'ship-dark', -26, -11.5, 30, 11.5, 1.5);
        path(hull, 'ship-line', 'M-16 -11.5 V0 M-6 -11.5 V0');
        path(hull, 'ship-hull', 'M35 0 C35 -5 29 -8 21 -10 L4 -12.5 V12.5 L21 10 C29 8 35 5 35 0 Z');
        path(hull, 'ship-stripe', 'M7 -12 V12');
        rect(hull, 'ship-window', 17, -6.5, 6, 4.5, 1.5);
        rect(hull, 'ship-window', 17, 2, 6, 4.5, 1.5);
    },

    /** Ônibus espacial visto de cima: asa em delta duplo e três motores. */
    shuttle(hull) {
        for (const y of [-3.6, 0, 3.6]) circle(hull, 'ship-glow', -38.5, y, 1.7);
        mirrored(hull, g => path(g, 'ship-fins', 'M16 -6 L-6 -9.5 L-26 -19.5 H-35 V-6 Z'));
        rect(hull, 'ship-engine', -38, -6, 8, 12, 2);
        path(hull, 'ship-hull', 'M37 0 C37 -4 31 -6.5 24 -6.5 H-31 V6.5 H24 C31 6.5 37 4 37 0 Z');
        rect(hull, 'ship-line', -25, -4, 42, 8, 1);
        path(hull, 'ship-line', 'M-25 0 H17');
        path(hull, 'ship-window', 'M25 -3.6 L31 -1.8 V1.8 L25 3.6 Z');
    },

    /** Cargueiro não tripulado: cilindro com dois painéis solares redondos. */
    cargo(hull) {
        mirrored(hull, g => {
            circle(g, 'ship-dark', -16, -12.5, 7);
            path(g, 'ship-line', 'M-23 -12.5 H-9 M-16 -19.5 V-5.5 M-21 -17.5 L-11 -7.5 M-21 -7.5 L-11 -17.5');
        });
        rect(hull, 'ship-engine', -29, -3.5, 5, 7, 1);
        rect(hull, 'ship-fins', -25, -7, 20, 14, 1.5);
        rect(hull, 'ship-hull', -7, -9.5, 40, 19, 7);
        path(hull, 'ship-stripe', 'M4 -9.5 V9.5 M18 -9.5 V9.5');
        circle(hull, 'ship-window', 30, 0, 2.2);
    },

    // ---------- Alien ----------

    /** Rebocador comercial: casco em blocos e três motores largos atrás. */
    nostromo(hull) {
        mirrored(hull, g => {
            rect(g, 'ship-fins', -35, -19.5, 27, 9, 1.5);
            rect(g, 'ship-glow', -38.5, -17.5, 3.5, 5, 0.8);
        });
        rect(hull, 'ship-glow', -40.5, -3, 3.5, 6, 0.8);
        rect(hull, 'ship-engine', -37, -6, 24, 12, 1.5);
        path(hull, 'ship-hull', 'M35 0 L29 -6.5 H15 L9 -12.5 H-15 V12.5 H9 L15 6.5 H29 Z');
        path(hull, 'ship-line', 'M-15 -5 H9 M-15 5 H9 M-3 -12.5 V12.5 M15 -6.5 V6.5');
        rect(hull, 'ship-dark', 1, -3, 6, 6, 0.8);
        rect(hull, 'ship-window', 22, -2.6, 6, 5.2, 1);
    },

    /** Nave salva-vidas: cunha curta com um motor de cada lado. */
    narcissus(hull) {
        mirrored(hull, g => {
            rect(g, 'ship-engine', -33, -16, 17, 7.5, 2);
            circle(g, 'ship-glow', -34, -12.2, 1.9);
        });
        path(hull, 'ship-hull', 'M33 0 L18 -7.5 H-19 L-27 -12.5 V12.5 L-19 7.5 H18 Z');
        path(hull, 'ship-fins', 'M-19 -7.5 H-6 L-10 0 L-6 7.5 H-19 Z');
        path(hull, 'ship-window', 'M17 -4.4 L26 0 L17 4.4 Z');
        path(hull, 'ship-line', 'M2 -7.5 V7.5');
    },

    /** Nave militar comprida e fina, com antenas à frente. */
    sulaco(hull) {
        rect(hull, 'ship-glow', -42, -5.5, 3.5, 11, 0.8);
        path(hull, 'ship-cannon', 'M10 -5 L31 -11 M22 -3 L38 -6.5 M24 2.5 L38 5 M6 6 L22 12');
        path(hull, 'ship-fins', 'M-31 -8.5 L-25 -16 L-15 -8.5 Z M-30 8.5 L-22 15 L-10 8.5 Z');
        path(hull, 'ship-hull', 'M-39 -8.5 H-10 L-6 -5 H22 L36 -2 V1 L22 3.5 H-2 L-6 8.5 H-39 Z');
        rect(hull, 'ship-dark', -34, -4, 16, 8, 1);
        path(hull, 'ship-line', 'M-10 -8.5 V8.5 M4 -5 V3.5 M14 -5 V3.5');
    },

    /** Nave abandonada em forma de ferradura, com a abertura para a frente. */
    derelict(hull) {
        path(hull, 'ship-hull', 'M26 -17 C2 -24 -39 -17 -39 0 C-39 17 2 24 26 17 C10 16 -21 12.5 -21 0 C-21 -12.5 10 -16 26 -17 Z');
        ellipse(hull, 'ship-fins', -30, 0, 6.5, 8.5);
        path(hull, 'ship-line', 'M-12 -19.5 L-9 -12.5 M2 -20 L3 -14.5 M14 -19.5 L14 -15.5 M-24 -15.5 L-18 -9.5 '
            + 'M-12 19.5 L-9 12.5 M2 20 L3 14.5 M14 19.5 L14 15.5 M-24 15.5 L-18 9.5');
        circle(hull, 'ship-dark', -30, 0, 2.6);
    },
};

/** Nome de cada casco, mostrado ao passar o mouse sobre a nave. */
export const HULL_NAMES = {
    classic: 'Nave de transporte',
    falcon: 'Millennium Falcon',
    xwing: 'X-wing',
    destroyer: 'Star Destroyer',
    tie: 'Caça TIE',
    frigate: 'Fragata da UNSC',
    pelican: 'Pelican',
    covenant: 'Cruzador do Covenant',
    promethean: 'Nave Promethean',
    soyuz: 'Soyuz',
    dragon: 'Crew Dragon',
    shuttle: 'Ônibus espacial',
    cargo: 'Cargueiro Cygnus',
    nostromo: 'Nostromo',
    narcissus: 'Narcissus',
    sulaco: 'Sulaco',
    derelict: 'Nave abandonada',
};

/** Desenha o casco pedido; um nome desconhecido cai no casco padrão. */
export function drawHull(parent, scale, design = 'classic') {
    const hull = svg('g', {class: 'hull', transform: `scale(${scale})`}, parent);
    (HULLS[design] ?? HULLS.classic)(hull);
    return hull;
}

/** Efeito da situação de emergência, desenhado por cima do casco. */
export function drawEffect(hull, effect) {
    const g = svg('g', {class: `fx fx-${effect}`, 'aria-hidden': 'true'}, hull);
    if (effect === 'damage') {
        path(g, 'fx-scorch', 'M-14 -4 L-9 -1 L-13 3 L-7 5');
        [[-12, -5], [5, 4], [-20, 6]].forEach(([x, y], index) => {
            circle(g, 'fx-spark', x, y, 1.9).style.animationDelay = `${index * 0.37}s`;
        });
    } else if (effect === 'infection') {
        circle(g, 'fx-aura', 0, 0, 24);
        [[-10, -6], [8, 5], [-2, 8]].forEach(([x, y], index) => {
            circle(g, 'fx-spore', x, y, 1.6).style.animationDelay = `${index * 0.6}s`;
        });
    } else if (effect === 'leak') {
        [0, 1, 2].forEach(index => {
            circle(g, 'fx-puff', -4, -9, 1.8).style.animationDelay = `${index * 0.5}s`;
        });
    }
    return g;
}
