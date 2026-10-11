// Cena de sincronismo: lê os controles, inicia o cenário e mostra cada passo que as threads emitem.

import {connectSync} from './source.js';
import {EventPump} from './pump.js';
import {createState, applyEvent, describeBatch, statusOf, resourceShort} from './model.js';
import {SyncScene} from './scene.js';
import {WaitGraph} from './graph.js';

// Naves e recursos mostrados antes de o cenário começar (depois vale o que vier em SYNC_START)
const PREVIEW = {
    race: {spacecrafts: ['N1', 'N2', 'N3'], resources: [{id: 'ROBOTIC_ARM_A', capacity: 1}]},
    deadlock: {spacecrafts: ['N1', 'N2'], resources: [{id: 'ROBOTIC_ARM_A', capacity: 1}, {id: 'ROBOTIC_ARM_B', capacity: 1}]},
};

// O que cada combinação demonstra
const LESSONS = {
    'race|false': 'Sem exclusão mútua, mais de uma nave usa o braço ao mesmo tempo. É a condição de corrida: o resultado depende de quem chega primeiro, e a carga registrada fica errada.',
    'race|true': 'O semáforo deixa uma nave por vez no braço. As outras ficam em BLOCKED e só seguem quando ele é liberado. Nenhuma colisão e nenhuma carga perdida.',
    'deadlock|false': 'Sem trava ninguém espera, então não existe deadlock. Em troca, os dois braços são usados por duas naves ao mesmo tempo.',
    'deadlock|true|none': 'Cada nave segura um braço e espera o outro. Nenhuma solta o que tem, então nenhuma avança: é o deadlock. O ciclo aparece no grafo.',
    'deadlock|true|detection': 'Um detector encontra o ciclo no grafo, escolhe uma nave vítima e a faz soltar o braço. A outra termina, e depois a vítima tenta de novo.',
    'deadlock|true|timeout': 'Com tryLock e tempo limite, a nave que espera demais desiste, solta o braço que tinha e tenta de novo mais tarde. O ciclo se desfaz sozinho.',
};

const END_LABELS = {COMPLETED: 'Concluído', DEADLOCKED: 'Travado em deadlock', STOPPED: 'Interrompido'};
const OUTCOME_LABELS = {COMPLETED: 'Concluído', DEADLOCKED: 'Deadlock', STOPPED: 'Interrompido'};

const $ = id => document.getElementById(id);
const els = {
    source: $('source'),
    sourceText: $('source-text'),
    scenario: [...document.querySelectorAll('input[name="scenario"]')],
    sync: $('sync-toggle'),
    syncLabel: $('sync-label'),
    recoveryField: $('recovery-field'),
    recovery: $('recovery'),
    pace: $('pace'),
    run: $('btn-run'),
    runLabel: $('run-label'),
    runIcon: $('run-icon'),
    status: $('run-status'),
    badge: $('sync-badge'),
    banner: $('deadlock-banner'),
    caption: $('caption'),
    threads: document.querySelector('#threads-table tbody'),
    log: $('event-log'),
    collisions: $('result-collisions'),
    cargo: $('result-cargo'),
    outcome: $('result-status'),
    lesson: $('lesson'),
    fatal: $('fatal'),
};

const PLAY_ICON = 'M7 4l13 8-13 8z';
const STOP_ICON = 'M6 6h12v12H6z';

const scene = new SyncScene($('sync-scene'));
const graph = new WaitGraph($('wait-graph'));
const pump = new EventPump(onBatch, Number(els.pace.value));

let source = null;
let state = null;
let phase = 'idle'; // idle | running | ended
let accepting = false; // só aceita eventos depois do SYNC_START da execução atual
let log = [];
let message = '';

init();

async function init() {
    try {
        source = await connectSync(onEvent, onDisconnect);
        els.source.hidden = false;
        els.source.dataset.mode = source.mode;
        els.sourceText.textContent = source.mode === 'server'
            ? 'Dados do servidor'
            : 'Modo demonstração: arquivos de exemplo';

        els.scenario.forEach(radio => radio.addEventListener('change', resetToPreview));
        els.sync.addEventListener('change', resetToPreview);
        els.recovery.addEventListener('change', resetToPreview);
        els.pace.addEventListener('change', () => pump.setGap(Number(els.pace.value)));
        els.run.addEventListener('click', () => (phase === 'running' ? stop() : start()));
        resetToPreview();
    } catch (error) {
        els.fatal.hidden = false;
        els.fatal.textContent = `Não foi possível iniciar a tela. ${error.message}`;
    }
}

function config() {
    return {
        scenario: els.scenario.find(radio => radio.checked).value,
        sync: els.sync.checked,
        recovery: els.recovery.value,
    };
}

function lessonKey({scenario, sync, recovery}) {
    return scenario === 'deadlock' && sync ? `${scenario}|${sync}|${recovery}` : `${scenario}|${sync}`;
}

/** Volta para a cena parada, com as naves e os braços da combinação escolhida. */
function resetToPreview() {
    const wasRunning = phase === 'running';
    accepting = false;
    pump.clear();
    if (wasRunning) source.stop().catch(() => {});
    if (source.cancel) source.cancel();

    const current = config();
    state = createState({...PREVIEW[current.scenario], ...current});
    phase = 'idle';
    log = [];
    message = '';
    els.recoveryField.hidden = !(current.scenario === 'deadlock' && current.sync);
    render([], false);
}

async function start() {
    resetToPreview();
    phase = 'running';
    render([], false);
    try {
        await source.start(config());
    } catch (error) {
        phase = 'idle';
        message = `Não foi possível iniciar: ${error.message}.`;
        render([], false);
    }
}

async function stop() {
    pump.clear(); // o que ainda não foi mostrado deixa de interessar
    try {
        await source.stop();
    } catch (error) {
        message = `Não foi possível parar: ${error.message}.`;
        render([], true);
    }
}

function onEvent(event) {
    if (phase !== 'running') return;
    if (event.type === 'SYNC_START') accepting = true;
    if (accepting) pump.push(event);
}

function onDisconnect() {
    message = 'A conexão com o servidor caiu. Recarregue a página para tentar de novo.';
    phase = phase === 'running' ? 'ended' : phase;
    render([], true);
}

/** Um passo na tela: um ou mais eventos que aconteceram juntos. */
function onBatch(batch) {
    const effects = [];
    const lines = describeBatch(state, batch);
    for (const event of batch) {
        if (event.type === 'SYNC_START') {
            state = createState(event);
        } else {
            effects.push(...applyEvent(state, event));
        }
    }
    const kind = batch.some(e => e.type === 'COLLISION' || e.type === 'DEADLOCK_DETECTED') ? 'alert' : 'normal';
    log.unshift({timeMs: batch[0].timeMs ?? 0, text: lines.join(' · '), kind});

    if (state.end) {
        phase = 'ended';
        accepting = false;
    }
    render(effects, true);
}

function render(effects, animate) {
    const current = config();
    scene.render(state, effects, animate);
    graph.render(state);

    els.syncLabel.textContent = current.sync ? 'Ligado' : 'Desligado';
    els.badge.dataset.sync = String(state.sync);
    els.badge.textContent = state.sync
        ? 'Sincronismo ligado: uma nave por braço'
        : 'Sincronismo desligado: sem exclusão mútua';

    const stuck = state.deadlock.length > 0;
    els.banner.hidden = !stuck;
    if (stuck) els.banner.textContent = `Deadlock: ${state.deadlock.join(' e ')} esperam uma pela outra`;

    els.caption.textContent = message || (log.length > 0
        ? log[0].text
        : 'Escolha o cenário, ligue ou desligue o sincronismo e inicie.');

    renderThreads();
    renderLog();
    renderResult(current);

    const running = phase === 'running';
    els.runIcon.setAttribute('d', running ? STOP_ICON : PLAY_ICON);
    els.runLabel.textContent = running ? 'Parar' : (phase === 'ended' ? 'Repetir' : 'Iniciar');
    els.run.classList.toggle('is-running', running);
    els.status.textContent = running ? 'Em execução' : (phase === 'ended' ? endLabel() : 'Pronto para iniciar');
    els.status.dataset.phase = phase === 'ended' ? String(state.end?.reason ?? 'ended') : phase;
}

function endLabel() {
    return END_LABELS[state.end?.reason] ?? 'Encerrado';
}

function cell(tag, textContent, className) {
    const node = document.createElement(tag);
    node.textContent = textContent;
    if (className) node.className = className;
    return node;
}

function renderThreads() {
    const rows = state.ships.map(ship => {
        const status = statusOf(ship);
        const row = document.createElement('tr');
        row.className = `row-${status}`;

        const name = cell('th', ship.id);
        name.scope = 'row';
        const dot = document.createElement('span');
        dot.className = 'ship-dot';
        dot.style.background = ship.color;
        name.prepend(dot);

        const badge = document.createElement('td');
        badge.append(cell('b', status, `state state-${status}`));

        row.append(
            name,
            badge,
            cell('td', ship.holds.map(resourceShort).join(', ') || '—'),
            cell('td', ship.waitsFor !== null ? resourceShort(ship.waitsFor) : '—'));
        return row;
    });
    els.threads.replaceChildren(...rows);
}

function renderLog() {
    if (log.length === 0) {
        els.log.replaceChildren(cell('li', 'Nenhum evento ainda.', 'log-empty'));
        return;
    }
    const seconds = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
    els.log.replaceChildren(...log.map((entry, index) => {
        const item = document.createElement('li');
        item.className = [index === 0 ? 'is-now' : '', entry.kind === 'alert' ? 'is-alert' : ''].join(' ').trim();
        item.append(cell('span', `${seconds.format(entry.timeMs / 1000)} s`, 'log-tick'), cell('span', entry.text, 'log-text'));
        return item;
    }));
}

function renderResult(current) {
    els.collisions.textContent = String(state.collisions);
    els.collisions.classList.toggle('is-bad', state.collisions > 0);

    const end = state.end;
    if (end && end.cargoExpected != null && end.cargoActual != null) {
        els.cargo.textContent = `${end.cargoActual} de ${end.cargoExpected}`;
        els.cargo.classList.toggle('is-bad', Number(end.cargoActual) < Number(end.cargoExpected));
    } else {
        els.cargo.textContent = '—';
        els.cargo.classList.remove('is-bad');
    }

    els.outcome.textContent = phase === 'ended'
        ? (OUTCOME_LABELS[end?.reason] ?? 'Encerrado')
        : (phase === 'running' ? 'Rodando' : '—');
    els.outcome.classList.toggle('is-bad', end?.reason === 'DEADLOCKED');
    els.lesson.textContent = LESSONS[lessonKey(current)] ?? '';
}
