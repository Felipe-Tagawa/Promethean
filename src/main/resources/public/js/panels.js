// Painéis de texto: tabela de naves, registro de eventos e tabela de métricas.

import {describeEvent} from './timeline.js';

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

/** Uma linha por nave, com o estado e os contadores do tick atual. */
export function renderShips(tbody, timeline, frame) {
    const rows = timeline.ships.map(ship => {
        const now = frame.ships[ship.id];
        const dot = el('span', {className: 'ship-dot'});
        dot.style.background = ship.color;
        return el('tr', {className: `row-${now.state}`}, [
            el('th', {}, [dot, document.createTextNode(ship.id)]),
            el('td', {}, [el('b', {className: `state state-${now.state}`, text: now.state})]),
            el('td', {className: 'num', text: String(ship.arrivalTime)}),
            el('td', {className: 'num', text: String(ship.burstTime)}),
            el('td', {className: 'num', text: String(now.remaining)}),
            el('td', {className: 'num', text: String(now.waiting)}),
        ]);
    });
    tbody.replaceChildren(...rows);
    tbody.querySelectorAll('th').forEach(th => th.setAttribute('scope', 'row'));
}

/** Eventos até o tick atual, do mais recente para o mais antigo. */
export function renderLog(list, timeline, tick) {
    const items = timeline.events
        .filter(e => e.tick <= tick)
        .reverse()
        .map(e => el('li', {className: e.tick === tick ? 'is-now' : ''}, [
            el('span', {className: 'log-tick', text: `t=${e.tick}`}),
            el('span', {className: `log-type type-${e.type}`, text: e.type}),
            el('span', {className: 'log-text', text: describeEvent(e)}),
        ]));
    if (items.length === 0) {
        items.push(el('li', {className: 'log-empty', text: 'Nenhum evento ainda.'}));
    }
    list.replaceChildren(...items);
}

/**
 * Uma linha por algoritmo, com o menor valor de cada coluna destacado.
 * @param entries lista de {key, name, timeline}
 */
export function renderMetrics(tbody, note, entries, activeKey, onSelect) {
    const columns = ['avgWaitingTime', 'avgTurnaroundTime', 'avgResponseTime', 'contextSwitches'];
    const withMetrics = entries.filter(e => e.timeline.metrics);
    const best = {};
    for (const column of columns.slice(0, 3)) {
        best[column] = withMetrics.length > 1
            ? Math.min(...withMetrics.map(e => Number(e.timeline.metrics[column])))
            : null;
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
            + (withMetrics.length > 1 ? 'Em destaque, o menor valor de cada coluna.' : '');
    } else {
        note.textContent = '';
    }
}
