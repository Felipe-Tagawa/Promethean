// Painéis de texto: tabela de naves, registro de eventos e tabela de métricas.

import {describeEvent, totalWait} from './timeline.js';
import {priorityContext} from './universe.js';
import {iconElement} from './icons.js';

function el(tag, {className, text, title} = {}, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (title) node.title = title;
    node.append(...children);
    return node;
}

const decimal = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const rate = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3});
const signedDecimal = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero'});
const signedWhole = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0, signDisplay: 'exceptZero'});

/**
 * Segunda linha de uma nave na tabela: a situação que o universo dá à prioridade dela
 * ou, se uma ameaça a atingiu, o que aconteceu.
 */
function contextTag(ship, now, timeline, universe) {
    const threat = timeline.threat?.name ?? 'ameaça';
    let icon, title, detail, rank, note;

    if (now.state === 'KILLED') {
        const tick = timeline.results.get(ship.id).killed;
        icon = 'alert';
        title = now.exit === 'explode' ? 'Destruída' : 'Deixou a órbita';
        detail = `tick ${tick} · ${threat}`;
        rank = 0;
    } else if (now.boosted) {
        icon = 'alert';
        title = 'Prioridade máxima';
        detail = threat;
        rank = 0;
    } else if (now.revived) {
        icon = 'alert';
        title = 'Revivida';
        detail = `tick ${timeline.results.get(ship.id).revived} · recomeçou do zero`;
        rank = Math.min(ship.priorityRank, 3);
    } else {
        const context = priorityContext(universe, ship.priorityRank);
        icon = context.icon;
        title = `Prioridade ${ship.basePriority}`;
        detail = context.label;
        rank = Math.min(ship.priorityRank, 3);
        note = context.note;
    }

    const tag = el('span', {className: 'context', title: note}, [
        iconElement(icon),
        el('b', {text: title}),
        el('span', {className: 'context-text', text: detail}),
    ]);
    tag.dataset.rank = String(rank);
    return tag;
}

/**
 * Uma linha por nave, com o estado e os contadores do tick atual.
 * Se a gravação tem prioridades, cada nave ganha uma segunda linha com a situação dela.
 */
export function renderShips(tbody, timeline, frame, universe) {
    const rows = timeline.ships.flatMap(ship => {
        const now = frame.ships[ship.id];
        const dot = el('span', {className: 'ship-dot'});
        dot.style.background = ship.color;
        // O burst só muda quando uma ameaça obriga a nave a ficar mais tempo na porta
        const grew = now.burst !== ship.burstTime;
        // O nome real fica embaixo do id, menor; sem nome, só o id, como antes
        const label = ship.name
            ? [dot, document.createTextNode(ship.id), el('span', {className: 'ship-name', text: ship.name})]
            : [dot, document.createTextNode(ship.id)];
        const main = el('tr', {className: `row-${now.state}`}, [
            el('th', {title: ship.name ?? undefined}, label),
            el('td', {}, [el('b', {className: `state state-${now.state}`, text: now.state})]),
            el('td', {className: 'num', text: String(ship.arrivalTime)}),
            el('td', {
                className: grew ? 'num is-changed' : 'num',
                text: String(now.burst),
                title: grew ? `Era ${ship.burstTime} antes da ameaça` : undefined,
            }),
            el('td', {className: 'num', text: String(now.remaining)}),
            el('td', {className: 'num', text: String(now.waiting)}),
        ]);
        if (ship.priorityRank === null) return [main];

        const cell = el('td', {}, [contextTag(ship, now, timeline, universe)]);
        cell.colSpan = main.children.length;
        main.classList.add('row-main');
        return [main, el('tr', {className: `row-${now.state} row-context`}, [cell])];
    });
    tbody.replaceChildren(...rows);
    tbody.querySelectorAll('th').forEach(th => th.setAttribute('scope', 'row'));
}

/**
 * Eventos até o tick atual, do mais recente para o mais antigo.
 * @param situationOf devolve a situação de prioridade de uma nave, citada na chegada dela
 */
export function renderLog(list, timeline, tick, situationOf) {
    const items = timeline.events
        .filter(e => e.tick <= tick)
        .reverse()
        .map(e => el('li', {className: e.tick === tick ? 'is-now' : ''}, [
            el('span', {className: 'log-tick', text: `t=${e.tick}`}),
            el('span', {className: `log-type type-${e.type}`, text: e.type}),
            el('span', {className: 'log-text', text: describeEvent(e, situationOf)}),
        ]));
    if (items.length === 0) {
        items.push(el('li', {className: 'log-empty', text: 'Nenhum evento ainda.'}));
    }
    list.replaceChildren(...items);
}

/**
 * Célula de uma métrica. Com uma ameaça ativa, mostra embaixo a diferença para a simulação sem ameaça.
 * Em todas as colunas, menor é melhor.
 */
function metricCell(value, baseValue, isBest, whole) {
    const cell = el('td', {className: isBest ? 'num is-best' : 'num', text: whole ? String(Math.round(value)) : decimal.format(value)});
    const delta = baseValue == null ? 0 : value - baseValue;
    if (Math.abs(delta) >= 0.005) {
        cell.append(el('small', {
            className: delta > 0 ? 'delta is-worse' : 'delta is-better',
            text: (whole ? signedWhole : signedDecimal).format(delta),
            title: `Sem a ameaça: ${whole ? Math.round(baseValue) : decimal.format(baseValue)}`,
        }));
    }
    return cell;
}

/**
 * Uma linha por algoritmo, com o menor valor de cada coluna destacado.
 * A última coluna é a espera da nave mais urgente: é onde a diferença entre os algoritmos fica mais clara.
 * @param entries lista de {key, name, timeline, base}; `base` é a linha do tempo sem ameaça, quando há uma ativa
 * @param situationOf devolve a situação de prioridade de uma nave
 */
export function renderMetrics(tbody, note, entries, activeKey, onSelect, situationOf) {
    const columns = ['avgWaitingTime', 'avgTurnaroundTime', 'avgResponseTime', 'contextSwitches'];
    const withMetrics = entries.filter(e => e.timeline.metrics);
    const best = {};
    for (const column of columns.slice(0, 3)) {
        best[column] = withMetrics.length > 1
            ? Math.min(...withMetrics.map(e => Number(e.timeline.metrics[column])))
            : null;
    }

    // A carga é a mesma em todos os algoritmos, então a nave mais urgente também é
    const urgentId = entries[0]?.timeline.urgentId ?? null;
    const urgentWaits = entries.map(e => totalWait(e.timeline, urgentId)).filter(wait => wait !== null);
    const bestUrgent = urgentWaits.length > 1 ? Math.min(...urgentWaits) : null;
    const urgentHead = tbody.parentElement.querySelector('[data-col="urgent"]');
    urgentHead.hidden = urgentId === null;
    if (urgentId !== null) {
        urgentHead.replaceChildren('Espera', document.createElement('br'), urgentId); // em duas linhas, para a coluna ficar estreita
        urgentHead.title = `Ticks que ${urgentId}, a nave mais urgente, passou na órbita de espera`;
    }

    const rows = entries.map(entry => {
        const metrics = entry.timeline.metrics;
        const baseMetrics = entry.base?.metrics ?? null;
        const button = el('button', {className: 'link-btn', text: entry.name, title: `Mostrar ${entry.name} na cena`});
        button.type = 'button';
        button.addEventListener('click', () => onSelect(entry.key));
        const head = el('th', {}, [button]);
        const lost = Number(metrics?.lost ?? 0);
        if (lost > 0) {
            head.append(el('small', {
                className: 'delta is-worse',
                text: lost === 1 ? '1 nave perdida' : `${lost} naves perdidas`,
                title: 'As médias consideram só as naves que terminaram',
            }));
        }

        const cells = columns.map(column => {
            if (!metrics || metrics[column] == null) return el('td', {className: 'num', text: '—'});
            const value = Number(metrics[column]);
            const baseValue = baseMetrics?.[column] == null ? null : Number(baseMetrics[column]);
            const isBest = best[column] !== null && value === best[column];
            return metricCell(value, baseValue, isBest, column === 'contextSwitches');
        });
        if (urgentId !== null) {
            const wait = totalWait(entry.timeline, urgentId);
            if (wait === null) {
                cells.push(el('td', {className: 'num', text: 'perdida', title: `${urgentId} não terminou`}));
            } else {
                const baseWait = entry.base ? totalWait(entry.base, urgentId) : null;
                cells.push(metricCell(wait, baseWait, bestUrgent !== null && wait === bestUrgent, true));
            }
        }
        const row = el('tr', {className: entry.key === activeKey ? 'is-active' : ''}, [head, ...cells]);
        head.setAttribute('scope', 'row');
        return row;
    });
    tbody.replaceChildren(...rows);

    const active = entries.find(e => e.key === activeKey);
    const metrics = active?.timeline.metrics;
    if (metrics && metrics.throughput != null) {
        const count = active.timeline.ships.length;
        const finished = count - Number(metrics.lost ?? 0);
        const ships = finished === count ? `${count} naves` : `${finished} de ${count} naves terminaram`;
        note.textContent = `${active.name}: ${ships} em ${active.timeline.totalTicks} ticks, `
            + `throughput de ${rate.format(Number(metrics.throughput))} nave por tick. `
            + (withMetrics.length > 1 ? 'Em destaque, o menor valor de cada coluna.' : '')
            + urgentSentence(active.timeline, urgentId, situationOf)
            + threatSentence(active);
    } else {
        note.textContent = '';
    }
}

function urgentSentence(timeline, urgentId, situationOf) {
    const wait = totalWait(timeline, urgentId);
    if (wait === null) return '';
    const situation = situationOf?.(urgentId);
    return ` A nave mais urgente, ${urgentId}${situation ? ` (${situation})` : ''}, esperou ${wait} ${wait === 1 ? 'tick' : 'ticks'}.`;
}

function threatSentence(entry) {
    if (!entry.base) return '';
    const lost = Number(entry.timeline.metrics.lost ?? 0);
    return ` Com a ameaça "${entry.timeline.threat.name}", os números pequenos mostram a diferença para a simulação sem ameaça.`
        + (lost > 0 ? ' As médias consideram só as naves que terminaram.' : '');
}
