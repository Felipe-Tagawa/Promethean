// Liga as peças: carrega as gravações, monta a cena e repassa cada mudança de tick para os painéis.

import {connect, loadRecording} from './api.js';
import {buildTimeline, describeEvent} from './timeline.js';
import {Player} from './player.js';
import {Scene} from './scene.js';
import {Gantt} from './gantt.js';
import {renderShips, renderLog, renderMetrics} from './panels.js';
import {bindUniverseSelect, priorityContext} from './universe.js';
import {simulate, sameEvents, SUPPORTED} from './engine.js';
import {threatsOf, findThreat} from './threats.js';

const PLAY_ICON = 'M7 4l13 8-13 8z';
const PAUSE_ICON = 'M7 4h4v16H7zM13 4h4v16h-4z';

const $ = id => document.getElementById(id);
const els = {
    source: $('source'),
    sourceText: $('source-text'),
    algorithm: $('algorithm'),
    threat: $('threat'),
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
    legendKilled: $('legend-killed'),
    log: $('event-log'),
    metricsBody: document.querySelector('#metrics-table tbody'),
    metricsNote: $('metrics-note'),
    fatal: $('fatal'),
};

const state = {
    source: null,     // de onde vieram as gravações: servidor ou arquivos de exemplo
    baseline: [],     // {key, name, recording, timeline} de cada algoritmo carregado: a simulação sem ameaça
    entries: [],      // o que está na tela: a baseline ou, com uma ameaça ativa, a simulação refeita pelo motor da tela
    active: null,     // entrada mostrada na cena
    threat: null,     // ameaça ativa (threats.js); null = nenhuma
    engineOk: false,  // o motor da tela reproduz as gravações recebidas?
};

// O universo é só aparência: trocar não mexe na simulação nem no tick atual
let universe = bindUniverseSelect($('universe'), onUniverseChange);

const scene = new Scene($('scene'), universe);
const player = new Player(onPlayerChange);
const gantt = new Gantt($('gantt'), {onSeek: tick => player.seek(tick), onSelect: selectAlgorithm});

init();

async function init() {
    try {
        state.source = await connect();
        els.source.hidden = false;

        // Todas as gravações são carregadas de uma vez: é o que preenche a comparação
        const loaded = await Promise.allSettled(state.source.algorithms.map(algorithm =>
            loadRecording(state.source, algorithm).then(recording => ({recording, timeline: buildTimeline(recording)}))));

        const failures = [];
        state.source.algorithms.forEach((algorithm, index) => {
            const result = loaded[index];
            const option = new Option(algorithm.name, algorithm.key);
            if (result.status === 'fulfilled') {
                state.baseline.push({key: algorithm.key, name: algorithm.name, ...result.value});
            } else {
                option.dataset.failed = 'true';
                option.disabled = true;
                option.text = `${algorithm.name} (indisponível)`;
                failures.push(`${algorithm.name}: ${result.reason.message}`);
            }
            els.algorithm.add(option);
        });

        if (state.baseline.length === 0) {
            throw new Error(`Nenhuma simulação pôde ser carregada. ${failures.join(' ')}`);
        }

        state.entries = state.baseline;
        state.engineOk = engineMatches();
        fillThreats();
        renderSource();
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

    // Cada universo tem as suas ameaças: ao trocar, a tela volta para a simulação sem ameaça
    const hadThreat = state.threat !== null;
    fillThreats();
    if (hadThreat) {
        applyThreat(null);
        return;
    }
    renderMetrics(els.metricsBody, els.metricsNote, state.entries, state.active.key, selectAlgorithm, situationOf);
    player.emit(false); // redesenha o tick atual com as naves e os textos do novo universo
}

/** Situação que o universo atual dá à prioridade da nave; null se a gravação não traz prioridades. */
function situationOf(shipId) {
    const ship = state.active?.timeline.ships.find(s => s.id === shipId);
    return ship?.priorityRank == null ? null : priorityContext(universe, ship.priorityRank).label;
}

// ---------- ameaças ----------

/**
 * As ameaças só ficam disponíveis se o motor da tela, sem ameaça nenhuma, reproduzir a gravação recebida
 * em todos os algoritmos que ele conhece. Assim uma mudança nas regras do servidor não passa despercebida.
 */
function engineMatches() {
    const known = state.baseline.filter(entry => SUPPORTED.includes(entry.key));
    return known.length > 0 && known.every(entry => {
        try {
            const mine = simulate({
                algorithm: entry.key, name: entry.name,
                spacecrafts: entry.recording.spacecrafts, ports: entry.timeline.ports,
            });
            return sameEvents(mine.events, entry.timeline.events);
        } catch {
            return false;
        }
    });
}

/** Preenche o seletor com as ameaças do universo atual. A página sempre abre em "Nenhuma". */
function fillThreats() {
    const options = [new Option('Nenhuma', '')];
    for (const threat of threatsOf(universe.key)) {
        const option = new Option(threat.name, threat.key);
        option.title = threat.summary;
        options.push(option);
    }
    els.threat.replaceChildren(...options);
    els.threat.value = '';
    els.threat.disabled = !state.engineOk;
    els.threat.title = state.engineOk
        ? 'Um imprevisto durante a simulação. Com uma ameaça ativa, quem recalcula o escalonamento é a tela, não o servidor.'
        : 'Indisponível: o simulador da tela não reproduziu a gravação recebida, então o resultado com ameaça não seria confiável.';
}

/** Troca a simulação na tela: a do servidor (sem ameaça) ou a refeita pelo motor da tela com a ameaça. */
function applyThreat(threat) {
    state.threat = threat;
    if (threat === null) {
        state.entries = state.baseline;
    } else {
        // A mesma ameaça vale para todos os algoritmos, para a comparação continuar justa
        state.entries = state.baseline.filter(base => SUPPORTED.includes(base.key)).map(base => ({
            key: base.key,
            name: base.name,
            base: base.timeline,
            timeline: buildTimeline(simulate({
                algorithm: base.key, name: base.name,
                spacecrafts: base.recording.spacecrafts, ports: base.timeline.ports, threat,
            })),
        }));
    }

    for (const option of els.algorithm.options) {
        if (!option.dataset.failed) option.disabled = !state.entries.some(entry => entry.key === option.value);
    }
    els.threat.closest('.field').classList.toggle('is-active', threat !== null);
    els.legendKilled.hidden = threat === null;
    renderSource();
    gantt.load(state.entries);

    const key = state.entries.some(entry => entry.key === state.active?.key) ? state.active.key : state.entries[0].key;
    state.active = null; // força a recarga da cena com a nova simulação, do tick 0
    selectAlgorithm(key);
}

/** O aviso do canto de cima: de onde vêm os números que estão na tela. */
function renderSource() {
    if (state.threat) {
        els.source.dataset.mode = 'threat';
        els.sourceText.textContent = `Simulação da tela: ${state.threat.name}`;
        els.source.title = `${state.threat.summary} O servidor não conhece ameaças: este resultado foi recalculado pela tela.`;
        return;
    }
    els.source.dataset.mode = state.source.mode;
    els.sourceText.textContent = state.source.mode === 'server'
        ? 'Dados do servidor'
        : 'Modo demonstração: arquivos de exemplo';
    els.source.title = '';
}

function bindControls() {
    els.algorithm.addEventListener('change', () => selectAlgorithm(els.algorithm.value));
    els.threat.addEventListener('change', () => applyThreat(findThreat(universe.key, els.threat.value)));
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
    els.hudUrgentValue.textContent = now.state === 'KILLED'
        ? `${id} · perdida`
        : `${id} · ${now.waiting} ${now.waiting === 1 ? 'tick' : 'ticks'}`;
    els.hudUrgent.classList.toggle('is-waiting', now.state === 'READY' || now.state === 'KILLED');
}

/** Frase que resume o tick: os eventos dele ou, se não houve nenhum, quem está na porta. */
function captionFor(frame, timeline) {
    const parts = frame.events.map(e => describeEvent(e, situationOf));
    if (parts.length === 0) {
        for (const ship of timeline.ships) {
            const now = frame.ships[ship.id];
            if (now.state !== 'RUNNING') continue;
            parts.push(frame.portsDown
                ? `${ship.id} está parada na porta ${now.portId}, que segue interditada`
                : `${ship.id} segue na porta ${now.portId} (resta ${now.remaining})`);
        }
        if (parts.length === 0) parts.push(frame.portsDown ? 'porta interditada' : 'nenhuma nave atracada');
    }
    if (frame.tick === timeline.totalTicks) parts.push('simulação encerrada');
    return `Tick ${frame.tick} — ${parts.join(' · ')}`;
}
