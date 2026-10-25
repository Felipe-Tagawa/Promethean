// Liga as peças: carrega as gravações, monta a cena e repassa cada mudança de tick para os painéis.

import {connect, loadRecording, RANDOM_KEY, DEFAULT_WORKLOAD} from './api.js';
import {buildTimeline, describeEvent} from './timeline.js';
import {Player} from './player.js';
import {Scene} from './scene.js';
import {Gantt} from './gantt.js';
import {renderShips, renderLog, renderMetrics} from './panels.js';
import {bindUniverseSelect, lockUniverse, priorityContext} from './universe.js';
import {simulate, sameEvents, SUPPORTED} from './engine.js';
import {threatsOf, findThreat} from './threats.js';

const PLAY_ICON = 'M7 4l13 8-13 8z';
const PAUSE_ICON = 'M7 4h4v16H7zM13 4h4v16h-4z';

// Limites da carga aleatória: os mesmos do servidor (Workload.random)
const RANDOM_SHIPS = {min: 3, max: 8, initial: 5};
const RANDOM_INITIAL_SEED = 42;

// Parâmetros da URL que guardam a carga, para um link reproduzir a mesma simulação
const URL_WORKLOAD = 'carga';
const URL_SEED = 'semente';
const URL_SHIPS = 'naves';

const $ = id => document.getElementById(id);
const els = {
    source: $('source'),
    sourceText: $('source-text'),
    universe: $('universe'),
    workload: $('workload'),
    randomFields: $('random-fields'),
    seed: $('seed'),
    ships: $('ships'),
    dice: $('btn-dice'),
    algorithm: $('algorithm'),
    threat: $('threat'),
    speed: $('speed'),
    play: $('btn-play'),
    playIcon: $('play-icon'),
    playLabel: $('play-label'),
    tick: $('tick'),
    tickTotal: $('tick-total'),
    hudWorkload: $('hud-workload'),
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
    source: null,     // de onde vieram as gravações: servidor ou simulador da tela
    workload: null,   // carga escolhida: {key, seed, ships}; seed e ships só valem na aleatória
    loadToken: 0,     // identifica o carregamento mais recente; um mais antigo que termine depois é descartado
    baseline: [],     // {key, name, recording, timeline} de cada algoritmo carregado: a simulação sem ameaça
    entries: [],      // o que está na tela: a baseline ou, com uma ameaça ativa, a simulação refeita pelo motor da tela
    active: null,     // entrada mostrada na cena
    threat: null,     // ameaça ativa (threats.js); null = nenhuma
    engineOk: false,  // o motor da tela reproduz as gravações recebidas?
};

// O universo é só aparência: trocar não mexe na simulação nem no tick atual.
// Numa carga temática, porém, ele fica travado no universo da carga (applyWorkloadControls)
let universe = bindUniverseSelect(els.universe, onUniverseChange);

const scene = new Scene($('scene'), universe);
const player = new Player(onPlayerChange);
const gantt = new Gantt($('gantt'), {onSeek: tick => player.seek(tick), onSelect: selectAlgorithm});

init();

async function init() {
    try {
        state.source = await connect();
        els.source.hidden = false;
        fillWorkloads();
        state.workload = initialWorkload();
        bindControls();
        await loadWorkload();
    } catch (error) {
        showError(`Não foi possível iniciar a tela. ${error.message}`);
    }
}

// ---------- cargas ----------

/** Preenche o seletor de carga: as de arquivo, na ordem do índice, e a aleatória se houver servidor. */
function fillWorkloads() {
    const options = state.source.workloads.map(entry => {
        const option = new Option(entry.title, entry.key);
        option.title = entry.description;
        return option;
    });
    if (state.source.random) {
        const option = new Option('Aleatória (com semente)', RANDOM_KEY);
        option.title = 'Naves sorteadas pelo servidor. A mesma semente gera sempre a mesma carga.';
        options.push(option);
    }
    els.workload.replaceChildren(...options);
}

/** A carga ao abrir a página: a da URL (?carga=...&semente=...&naves=...) ou a de referência. */
function initialWorkload() {
    const params = new URLSearchParams(location.search);
    const key = params.get(URL_WORKLOAD);
    const known = [...els.workload.options].some(option => option.value === key);
    return {
        key: known ? key : DEFAULT_WORKLOAD,
        seed: cleanSeed(params.get(URL_SEED) ?? RANDOM_INITIAL_SEED),
        ships: cleanShips(params.get(URL_SHIPS) ?? RANDOM_SHIPS.initial),
    };
}

/** Semente: inteiro não negativo. */
function cleanSeed(value) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number >= 0 ? number : RANDOM_INITIAL_SEED;
}

/** Número de naves da aleatória: inteiro de 3 a 8. */
function cleanShips(value) {
    const number = Math.floor(Number(value));
    if (!Number.isFinite(number)) return RANDOM_SHIPS.initial;
    return Math.min(RANDOM_SHIPS.max, Math.max(RANDOM_SHIPS.min, number));
}

function workloadEntry(key) {
    return state.source.workloads.find(entry => entry.key === key) ?? null;
}

/**
 * Ajusta os controles à carga escolhida: campos da aleatória, trava do universo, HUD e URL.
 * A carga de referência e a aleatória deixam o universo livre; as temáticas o travam no universo delas.
 */
function applyWorkloadControls() {
    const choice = state.workload;
    const entry = workloadEntry(choice.key);
    const isRandom = choice.key === RANDOM_KEY;

    els.workload.value = choice.key;
    els.workload.title = isRandom
        ? 'Naves sorteadas pelo servidor. A mesma semente gera sempre a mesma carga.'
        : entry?.description ?? '';
    els.randomFields.hidden = !isRandom;
    els.seed.value = String(choice.seed);
    els.ships.value = String(choice.ships);

    const themed = entry !== null && choice.key !== DEFAULT_WORKLOAD;
    lockUniverse(els.universe, themed ? entry.universe : null,
        themed ? `A carga "${entry.title}" pertence a este universo: os nomes das naves combinam com os desenhos.` : '');

    els.hudWorkload.textContent = isRandom ? `Aleatória · semente ${choice.seed}` : entry?.title ?? choice.key;

    // A URL guarda a carga: abrir o mesmo link reproduz a mesma simulação
    const url = new URL(location.href);
    url.searchParams.set(URL_WORKLOAD, choice.key);
    if (isRandom) {
        url.searchParams.set(URL_SEED, String(choice.seed));
        url.searchParams.set(URL_SHIPS, String(choice.ships));
    } else {
        url.searchParams.delete(URL_SEED);
        url.searchParams.delete(URL_SHIPS);
    }
    history.replaceState(null, '', url);
}

/** Troca a carga e recarrega todos os algoritmos com ela. */
function changeWorkload(next) {
    state.workload = {...state.workload, ...next};
    loadWorkload().catch(error => showError(`Não foi possível carregar a carga. ${error.message}`));
}

/**
 * Carrega a carga escolhida em todos os algoritmos de uma vez: é o que preenche a comparação.
 * Todos recebem a mesma carga, então a comparação entre eles é justa.
 */
async function loadWorkload() {
    const token = ++state.loadToken;
    const choice = {...state.workload};
    applyWorkloadControls();

    const loaded = await Promise.allSettled(state.source.algorithms.map(algorithm =>
        loadRecording(state.source, algorithm, choice).then(recording => ({recording, timeline: buildTimeline(recording)}))));
    if (token !== state.loadToken) return; // outra carga foi escolhida enquanto esta carregava

    const baseline = [];
    const failures = [];
    const options = state.source.algorithms.map((algorithm, index) => {
        const result = loaded[index];
        const option = new Option(algorithm.name, algorithm.key);
        if (result.status === 'fulfilled') {
            baseline.push({key: algorithm.key, name: algorithm.name, ...result.value});
        } else {
            option.dataset.failed = 'true';
            option.disabled = true;
            option.text = `${algorithm.name} (indisponível)`;
            failures.push(`${algorithm.name}: ${result.reason.message}`);
        }
        return option;
    });
    if (baseline.length === 0) {
        throw new Error(`Nenhuma simulação pôde ser carregada. ${failures.join(' ')}`);
    }

    const previous = state.active?.key;
    els.algorithm.replaceChildren(...options);
    hideError();

    // Uma carga nova começa sempre sem ameaça
    state.baseline = baseline;
    state.entries = baseline;
    state.threat = null;
    state.engineOk = engineMatches();
    fillThreats();
    els.threat.closest('.field').classList.remove('is-active');
    els.legendKilled.hidden = true;
    renderSource();
    gantt.load(state.entries);

    state.active = null; // força a recarga da cena com a nova simulação, do tick 0
    selectAlgorithm(baseline.some(entry => entry.key === previous) ? previous : baseline[0].key);
}

function showError(message) {
    els.fatal.hidden = false;
    els.fatal.textContent = message;
}

function hideError() {
    els.fatal.hidden = true;
    els.fatal.textContent = '';
}

// ---------- algoritmo e universo ----------

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
        : 'Modo demonstração: simulador da tela';
    els.source.title = state.source.mode === 'server'
        ? ''
        : 'Sem servidor: a tela simula as cargas de public/workloads com a cópia do motor (engine.js). A carga aleatória precisa do servidor.';
}

// ---------- controles ----------

function bindControls() {
    els.workload.addEventListener('change', () => changeWorkload({key: els.workload.value}));
    els.seed.addEventListener('change', () => changeWorkload({seed: cleanSeed(els.seed.value)}));
    els.ships.addEventListener('change', () => changeWorkload({ships: cleanShips(els.ships.value)}));
    els.dice.addEventListener('click', () => changeWorkload({seed: Math.floor(Math.random() * 1_000_000)}));
    els.algorithm.addEventListener('change', () => selectAlgorithm(els.algorithm.value));
    els.threat.addEventListener('change', () => applyThreat(findThreat(universe.key, els.threat.value)));
    els.speed.addEventListener('change', () => player.setSpeed(Number(els.speed.value)));
    els.play.addEventListener('click', () => player.toggle());
    $('btn-prev').addEventListener('click', () => player.step(-1));
    $('btn-next').addEventListener('click', () => player.step(1));
    $('btn-restart').addEventListener('click', () => player.seek(0));

    document.addEventListener('keydown', event => {
        // Em botões, seletores e campos o teclado já tem função própria
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
