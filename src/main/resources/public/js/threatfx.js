// Animações passageiras das ameaças: o que voa, atinge e explode na cena de escalonamento.
// São só enfeite: o estado que fica (nave destruída, porta interditada) é desenhado pela cena a partir do quadro.
// Cada peça é criada na camada de efeitos, animada uma vez e removida ao terminar.

import {svg, text} from './svg.js';
import {drawHull} from './hulls.js';

const ROCKS = [
    '0,-9 7,-5 9,3 3,9 -6,7 -9,-1 -4,-8',
    '0,-6 6,-3 5,4 -1,6 -6,2 -5,-4',
    '-2,-11 8,-6 11,2 4,10 -7,8 -11,0',
];

/** Anima `node` uma vez e o remove no fim. As posições são em pixels da cena. */
function animate(node, keyframes, options) {
    const animation = node.animate(keyframes, {fill: 'both', ...options});
    animation.finished.then(() => node.remove()).catch(() => node.remove());
    return animation;
}

const at = (point, extra = '') => `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px) ${extra}`.trim();

function flyTo(node, from, to, options, {fade = false, spin = 0} = {}) {
    return animate(node, [
        {transform: at(from), opacity: 1},
        {transform: at(to, spin ? `rotate(${spin}deg)` : ''), opacity: fade ? 0 : 1},
    ], options);
}

/** Clarão no ponto do impacto. */
function flash(layer, point, color, delay, duration) {
    const node = svg('circle', {r: 22, class: 'fx-flash'}, layer);
    node.style.fill = color;
    animate(node, [
        {transform: at(point, 'scale(.2)'), opacity: .95},
        {transform: at(point, 'scale(1.5)'), opacity: 0},
    ], {delay, duration, easing: 'ease-out'});
}

/** Anéis que se abrem em volta de um ponto: alarme na nave ou na porta. */
function rings(layer, point, color, delay, duration, size = 1) {
    for (const lag of [0, .35]) {
        const node = svg('circle', {r: 30 * size, class: 'fx-ring'}, layer);
        node.style.stroke = color;
        animate(node, [
            {transform: at(point, 'scale(.3)'), opacity: 0},
            {transform: at(point, 'scale(.5)'), opacity: .95, offset: .15},
            {transform: at(point, 'scale(1.6)'), opacity: 0},
        ], {delay: delay + duration * lag, duration, easing: 'ease-out'});
    }
}

function explosion(layer, point, delay, duration) {
    const points = [];
    for (let i = 0; i < 18; i++) {
        const radius = i % 2 === 0 ? 46 : 20;
        const angle = i * Math.PI / 9;
        points.push(`${(radius * Math.cos(angle)).toFixed(1)},${(radius * Math.sin(angle)).toFixed(1)}`);
    }
    const star = svg('polygon', {points: points.join(' '), class: 'fx-explosion'}, layer);
    animate(star, [
        {transform: at(point, 'scale(.2) rotate(0deg)'), opacity: 0},
        {transform: at(point, 'scale(.9) rotate(20deg)'), opacity: 1, offset: .25},
        {transform: at(point, 'scale(1.5) rotate(40deg)'), opacity: 0},
    ], {delay, duration: duration * 1.2, easing: 'ease-out'});
    rings(layer, point, '#ffd866', delay, duration, 1.3);
}

/** Texto curto que sobe e some: "+4", "prioridade máxima". */
function floatText(layer, point, content, color, delay, duration) {
    const node = text(content, {'text-anchor': 'middle', class: 'fx-text'}, layer);
    node.style.fill = color;
    animate(node, [
        {transform: at({x: point.x, y: point.y - 44}), opacity: 0},
        {transform: at({x: point.x, y: point.y - 56}), opacity: 1, offset: .2},
        {transform: at({x: point.x, y: point.y - 84}), opacity: 0},
    ], {delay, duration: duration * 2.4, easing: 'ease-out'});
}

// ---------- como a ameaça chega até o alvo ----------

const ARRIVALS = {

    /** Pedras cruzam a cena em diagonal; uma delas acerta o alvo. */
    shower(layer, target, visual, duration) {
        const step = {x: 300, y: 230};
        for (let i = 0; i < 7; i++) {
            const hit = i === 3;
            const offset = hit ? {x: 0, y: 0} : {x: (i - 3) * 95, y: (i % 2 === 0 ? -1 : 1) * 30};
            const from = {x: target.x - step.x + offset.x, y: target.y - step.y + offset.y};
            const to = hit ? target : {x: target.x + step.x + offset.x, y: target.y + step.y + offset.y};
            const rock = svg('polygon', {points: ROCKS[i % ROCKS.length], class: 'fx-rock'}, layer);
            rock.style.fill = visual.color;
            flyTo(rock, from, to, {
                delay: hit ? 0 : i * duration * .06,
                duration: hit ? duration * .6 : duration * 1.2,
                easing: 'linear',
            }, {spin: 200});
        }
        return duration * .6;
    },

    /** Uma nave inimiga passa por cima do alvo atirando. */
    flyby(layer, target, visual, duration) {
        const from = {x: -80, y: target.y - 150};
        const to = {x: 1080, y: target.y - 80};
        const attacker = svg('g', {class: 'fx-attacker'}, layer);
        attacker.style.setProperty('--ship-color', '#e8edff');
        drawHull(attacker, 1.1, visual.hull);
        const flight = duration * 1.5;
        flyTo(attacker, from, to, {duration: flight, easing: 'ease-in-out'});

        // Três disparos, do ponto em que o caça está até o alvo
        [.28, .34, .40].forEach(moment => {
            const origin = {x: from.x + (to.x - from.x) * moment, y: from.y + (to.y - from.y) * moment};
            const bolt = svg('circle', {r: 3.5, class: 'fx-bolt'}, layer);
            bolt.style.fill = visual.color;
            bolt.style.color = visual.color;
            animate(bolt, [
                {transform: at(origin), opacity: 0},
                {transform: at(origin), opacity: 1, offset: .05},
                {transform: at(target), opacity: 1},
            ], {delay: flight * moment, duration: duration * .22, easing: 'linear'});
        });
        return flight * .4 + duration * .22;
    },

    /** Um raio vindo de fora da cena. */
    beam(layer, target, visual, duration) {
        const beam = svg('line', {x1: target.x + 110, y1: -20, x2: target.x, y2: target.y, class: 'fx-beam'}, layer);
        beam.style.stroke = visual.color;
        beam.style.color = visual.color;
        animate(beam, [
            {opacity: 0, strokeWidth: '2px'},
            {opacity: 1, strokeWidth: '11px', offset: .3},
            {opacity: 1, strokeWidth: '7px', offset: .7},
            {opacity: 0, strokeWidth: '1px'},
        ], {duration: duration * .9, easing: 'ease-out'});
        return duration * .3;
    },

    /** Algo passa de uma nave para outra. */
    spread(layer, target, visual, duration, source) {
        const blob = svg('circle', {r: 6, class: 'fx-bolt'}, layer);
        blob.style.fill = visual.color;
        blob.style.color = visual.color;
        flyTo(blob, source ?? {x: target.x - 120, y: target.y - 90}, target, {duration: duration * .7, easing: 'ease-in'});
        return duration * .7;
    },

    /** Nada chega de fora: o problema está na própria nave. */
    alarm(layer, target, visual, duration) {
        rings(layer, target, visual.color, 0, duration * .8);
        return duration * .3;
    },
};

/**
 * Anima um evento de ameaça.
 * @param layer camada de efeitos da cena
 * @param event evento THREAT da gravação
 * @param visual como a ameaça é desenhada (threats.js)
 * @param target ponto atingido: a nave ou a porta
 * @param source de onde parte o que se espalha de nave em nave
 * @param station centro da estação, de onde saem as ondas de tempestade
 * @param duration duração de um movimento na velocidade atual, em milissegundos
 */
export function playThreat({layer, event, visual, target, source, station, duration}) {
    for (const effect of event.effects) {
        if (effect.kind === 'port-down') {
            if (visual.kind === 'storm') {
                // Ondas que partem da estação e varrem a cena
                [0, .3, .6].forEach(lag => {
                    const wave = svg('circle', {r: 100, class: 'fx-wave'}, layer);
                    wave.style.stroke = visual.color;
                    animate(wave, [
                        {transform: at(station, 'scale(.2)'), opacity: .9},
                        {transform: at(station, 'scale(7)'), opacity: 0},
                    ], {delay: duration * lag, duration: duration * 1.6, easing: 'ease-out'});
                });
            }
            rings(layer, target, visual.color, 0, duration);
            return;
        }
        if (effect.kind === 'port-up') {
            rings(layer, target, '#6ee7a0', 0, duration * .8, .8);
            return;
        }
    }

    const arrive = ARRIVALS[visual.kind] ?? ARRIVALS.alarm;
    const impact = arrive(layer, target, visual, duration, source);

    for (const effect of event.effects) {
        if (effect.kind === 'destroy') {
            if (effect.style !== 'abort') explosion(layer, target, impact, duration);
        } else {
            flash(layer, target, visual.color, impact, duration * .6);
            if (effect.kind === 'burst') floatText(layer, target, `+${effect.amount} de burst`, '#ffd866', impact, duration);
            if (effect.kind === 'priority') {
                // Com os dois efeitos na mesma nave, um texto fica acima do outro
                const lift = event.effects.length > 1 ? 18 : 0;
                floatText(layer, {x: target.x, y: target.y - lift}, 'prioridade máxima', '#ff7a90', impact, duration);
            }
        }
    }
}
