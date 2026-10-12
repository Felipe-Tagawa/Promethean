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

/**
 * Uma linha por nave, com o estado e os contadores do tick atual.
 * Se a gravação tem prioridades, cada nave ganha uma segunda linha com a situação que o universo dá à prioridade dela.
 */
export function renderShips(tbody, timeline, frame, universe) {
    const rows = timeline.ships.flatMap(ship => {
        const now = frame.ships[ship.id];
        const dot = el('span', {className: 'ship-dot'});
        dot.style.background = ship.color;
        const main = el('tr', {className: `row-${now.state}`}, [
            el('th', {}, [dot, document.createTextNode(ship.id)]),
            el('td', {}, [el('b', {className: `state state-${now.state}`, text: now.state})]),
            el('td', {className: 'num', text: String(ship.arrivalTime)}),
            el('td', {className: 'num', text: String(ship.burstTime)}),
            el('td', {className: 'num', text: String(now.remaining)}),
            el('td', {className: 'num', text: String(now.waiting)}),
        ]);
        if (ship.priorityRank === null) return [main];

        const context = priorityContext(universe, ship.priorityRank);
        const tag = el('span', {className: 'context', title: context.note}, [
            iconElement(context.icon),
            el('b', {text: `Prioridade ${ship.basePriority}`}),
            el('span', {className: 'context-text', text: context.label}),
        ]);
        tag.dataset.rank = String(Math.min(ship.priorityRank, 3));
        const cell = el('td', {}, [tag]);
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
 * Uma linha por algoritmo, com o menor valor de cada coluna destacado.
 * A última coluna é a espera da nave mais urgente: é onde a diferença entre os algoritmos fica mais clara.
 * @param entries lista de {key, name, timeline}
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
        const button = el('button', {className: 'link-btn', text: entry.name, title: `Mostrar ${entry.name} na cena`});
        button.type = 'button';
        button.addEventListener('click', () => onSelect(entry.key));

        const cells = columns.map(column => {
            if (!metrics || metrics[column] == null) return el('td', {className: 'num', text: '—'});
            const value = Number(metrics[column]);
            const formatted = column === 'contextSwitches' ? String(Math.round(value)) : decimal.format(value);
            const isBest = best[column] !== null && value === best[column];
            return el('td', {className: isBest ? 'num is-best' : 'num', text: formatted});
        });
        if (urgentId !== null) {
            const wait = totalWait(entry.timeline, urgentId);
            const isBest = bestUrgent !== null && wait === bestUrgent;
            cells.push(el('td', {className: isBest ? 'num is-best' : 'num', text: wait === null ? '—' : String(wait)}));
        }
        const row = el('tr', {className: entry.key === activeKey ? 'is-active' : ''}, [el('th', {}, [button]), ...cells]);
        row.firstChild.setAttribute('scope', 'row');
        return row;
    });
    tbody.replaceChildren(...rows);

    const active = entries.find(e => e.key === activeKey);
    const metrics = active?.timeline.metrics;
    if (metrics && metrics.throughput != null) {
        const count = active.timeline.ships.length;
        note.textContent = `${active.name}: ${count} naves em ${active.timeline.totalTicks} ticks, `
            + `throughput de ${rate.format(Number(metrics.throughput))} nave por tick. `
            + (withMetrics.length > 1 ? 'Em destaque, o menor valor de cada coluna.' : '')
            + urgentSentence(active.timeline, urgentId, situationOf);
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
