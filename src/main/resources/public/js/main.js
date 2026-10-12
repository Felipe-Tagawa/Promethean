// Liga as peças: carrega as gravações, monta a cena e repassa cada mudança de tick para os painéis.

import {connect, loadRecording} from './api.js';
import {buildTimeline, describeEvent} from './timeline.js';
import {Player} from './player.js';
import {Scene} from './scene.js';
import {Gantt} from './gantt.js';
import {renderShips, renderLog, renderMetrics} from './panels.js';
import {bindUniverseSelect, priorityContext} from './universe.js';

const PLAY_ICON = 'M7 4l13 8-13 8z';
const PAUSE_ICON = 'M7 4h4v16H7zM13 4h4v16h-4z';

const $ = id => document.getElementById(id);
const els = {
    source: $('source'),
    sourceText: $('source-text'),
    algorithm: $('algorithm'),
    speed: $('speed'),
    play: $('btn-play'),
    playIcon: $('play-icon'),
    playLabel: $('play-label'),
    tick: $('tick'),
    tickTotal: $('tick-total'),
    hudAlgorithm: $('hud-algorithm'),
    hudSwitches: $('hud-switches'),
    hudUrgent: $('hud-urgent'),
    hudUrgentValue: $('hud-urgent-value'),
    caption: $('caption'),
    shipsBody: document.querySelector('#ships-table tbody'),
    log: $('event-log'),
    metricsBody: document.querySelector('#metrics-table tbody'),
    metricsNote: $('metrics-note'),
    fatal: $('fatal'),
};

const state = {
    entries: [],   // {key, name, timeline} de cada algoritmo carregado
    active: null,  // entrada mostrada na cena
};

// O universo é só aparência: trocar não mexe na simulação nem no tick atual
let universe = bindUniverseSelect($('universe'), onUniverseChange);

const scene = new Scene($('scene'), universe);
const player = new Player(onPlayerChange);
const gantt = new Gantt($('gantt'), {onSeek: tick => player.seek(tick), onSelect: selectAlgorithm});

init();

async function init() {
    try {
        const source = await connect();
        els.source.hidden = false;
        els.source.dataset.mode = source.mode;
        els.sourceText.textContent = source.mode === 'server'
            ? 'Dados do servidor'
            : 'Modo demonstração: arquivos de exemplo';

        // Todas as gravações são carregadas de uma vez: é o que preenche a comparação
        const loaded = await Promise.allSettled(
            source.algorithms.map(algorithm => loadRecording(source, algorithm).then(buildTimeline)));

        const failures = [];
        source.algorithms.forEach((algorithm, index) => {
            const result = loaded[index];
            const option = new Option(algorithm.name, algorithm.key);
            if (result.status === 'fulfilled') {
                state.entries.push({key: algorithm.key, name: algorithm.name, timeline: result.value});
            } else {
                option.disabled = true;
                option.text = `${algorithm.name} (indisponível)`;
                failures.push(`${algorithm.name}: ${result.reason.message}`);
            }
            els.algorithm.add(option);
        });

        if (state.entries.length === 0) {
            throw new Error(`Nenhuma simulação pôde ser carregada. ${failures.join(' ')}`);
        }

        gantt.load(state.entries);
        bindControls();
        selectAlgorithm(state.entries[0].key);
    } catch (error) {
        els.fatal.hidden = false;
        els.fatal.textContent = `Não foi possível iniciar a tela. ${error.message}`;
    }
}

function selectAlgorithm(key) {
    const entry = state.entries.find(e => e.key === key);
    if (!entry || entry === state.active) return;
    state.active = entry;

    els.algorithm.value = key;
    els.hudAlgorithm.textContent = entry.name;
    scene.load(entry.timeline);
    gantt.setActive(key);
    renderMetrics(els.metricsBody, els.metricsNote, state.entries, key, selectAlgorithm, situationOf);
    $('scene').dataset.algorithm = key; // a legenda da cena explica o aging só no algoritmo de prioridade
    player.load(entry.timeline.totalTicks);
}

function onUniverseChange(next) {
    universe = next;
    scene.setUniverse(next);
    if (!state.active) return;
    renderMetrics(els.metricsBody, els.metricsNote, state.entries, state.active.key, selectAlgorithm, situationOf);
    player.emit(false); // redesenha o tick atual com as naves e os textos do novo universo
}

/** Situação que o universo atual dá à prioridade da nave; null se a gravação não traz prioridades. */
function situationOf(shipId) {
    const ship = state.active?.timeline.ships.find(s => s.id === shipId);
    return ship?.priorityRank == null ? null : priorityContext(universe, ship.priorityRank).label;
}

function bindControls() {
    els.algorithm.addEventListener('change', () => selectAlgorithm(els.algorithm.value));
    els.speed.addEventListener('change', () => player.setSpeed(Number(els.speed.value)));
    els.play.addEventListener('click', () => player.toggle());
    $('btn-prev').addEventListener('click', () => player.step(-1));
    $('btn-next').addEventListener('click', () => player.step(1));
    $('btn-restart').addEventListener('click', () => player.seek(0));

    document.addEventListener('keydown', event => {
        // Em botões e seletores o teclado já tem função própria
        if (event.target.closest('button, select, input, a') || event.ctrlKey || event.metaKey || event.altKey) return;
        switch (event.key) {
            case ' ':
                player.toggle();
                break;
            case 'ArrowRight':
                player.step(1);
                break;
            case 'ArrowLeft':
                player.step(-1);
                break;
            case 'Home':
                player.seek(0);
                break;
            case 'End':
                player.seek(player.total);
                break;
            default:
                return;
        }
        event.preventDefault();
    });
}

function onPlayerChange({tick, total, playing, animate, tickMs}) {
    if (!state.active) return;
    const timeline = state.active.timeline;
    const frame = timeline.frames[tick];

    // As naves levam um pouco menos que um tick para chegar; o cursor do Gantt leva o tick inteiro
    const root = document.documentElement.style;
    root.setProperty('--tick-ms', `${Math.round(tickMs)}ms`);
    root.setProperty('--move-ms', `${Math.round(Math.min(850, Math.max(160, tickMs * 0.85)))}ms`);

    scene.render(frame, animate);
    gantt.setTick(tick, animate);
    renderShips(els.shipsBody, timeline, frame, universe);
    renderLog(els.log, timeline, tick, situationOf);
    renderUrgent(timeline, frame);

    els.tick.textContent = String(tick);
    els.tickTotal.textContent = String(total);
    els.hudSwitches.textContent = String(frame.preemptions);
    els.caption.textContent = captionFor(frame, timeline);

    els.playIcon.setAttribute('d', playing ? PAUSE_ICON : PLAY_ICON);
    els.playLabel.textContent = playing ? 'Pausar' : 'Reproduzir';
    els.play.classList.toggle('is-playing', playing);
}

/** No canto da cena: quantos ticks a nave mais urgente já passou na órbita de espera. */
function renderUrgent(timeline, frame) {
    const id = timeline.urgentId;
    els.hudUrgent.hidden = id === null;
    if (id === null) return;
    const now = frame.ships[id];
    els.hudUrgentValue.textContent = `${id} · ${now.waiting} ${now.waiting === 1 ? 'tick' : 'ticks'}`;
    els.hudUrgent.classList.toggle('is-waiting', now.state === 'READY');
}

/** Frase que resume o tick: os eventos dele ou, se não houve nenhum, quem está na porta. */
function captionFor(frame, timeline) {
    const parts = frame.events.map(e => describeEvent(e, situationOf));
    if (parts.length === 0) {
        for (const ship of timeline.ships) {
            const now = frame.ships[ship.id];
            if (now.state === 'RUNNING') parts.push(`${ship.id} segue na porta ${now.portId} (resta ${now.remaining})`);
        }
        if (parts.length === 0) parts.push('nenhuma nave atracada');
    }
    if (frame.tick === timeline.totalTicks) parts.push('simulação encerrada');
    return `Tick ${frame.tick} — ${parts.join(' · ')}`;
}
