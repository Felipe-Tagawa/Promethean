// Linha do tempo: um Gantt por algoritmo, empilhados na mesma escala, com um cursor que pode ser arrastado.

function div(className, parent) {
    const node = document.createElement('div');
    node.className = className;
    if (parent) parent.append(node);
    return node;
}

export class Gantt {

    /**
     * @param container elemento que recebe o Gantt
     * @param onSeek chamado com o tick escolhido ao clicar ou arrastar
     * @param onSelect chamado com a chave do algoritmo ao clicar no nome de uma linha
     */
    constructor(container, {onSeek, onSelect}) {
        this.container = container;
        this.onSeek = onSeek;
        this.onSelect = onSelect;
        this.maxTicks = 1;
        this.rows = new Map();
    }

    /** @param entries lista de {key, name, timeline} */
    load(entries) {
        this.container.replaceChildren();
        this.rows.clear();
        this.maxTicks = Math.max(1, ...entries.map(e => e.timeline.totalTicks));

        const names = div('gantt-names', this.container);
        this.tracks = div('gantt-tracks', this.container);

        for (const entry of entries) {
            const name = document.createElement('button');
            name.type = 'button';
            name.className = 'gantt-name';
            name.textContent = entry.name;
            name.title = `Mostrar ${entry.name} na cena`;
            name.addEventListener('click', () => this.onSelect(entry.key));
            names.append(name);

            const track = div('gantt-track', this.tracks);
            const colors = new Map(entry.timeline.ships.map(s => [s.id, s.color]));
            const shipNames = new Map(entry.timeline.ships.map(s => [s.id, s.name]));
            for (const segment of entry.timeline.segments) {
                const seg = div('gantt-seg', track);
                seg.style.left = this.percent(segment.start);
                seg.style.width = this.percent(segment.end - segment.start);
                seg.style.setProperty('--ship-color', colors.get(segment.spaceCraftId));
                // A barra mostra o id curto; a dica, também o nome real
                const shipName = shipNames.get(segment.spaceCraftId);
                seg.title = `${segment.spaceCraftId}${shipName ? ` (${shipName})` : ''}: tick ${segment.start} a ${segment.end}`;
                const label = document.createElement('span');
                label.textContent = segment.spaceCraftId;
                seg.append(label);
            }
            // Só existem com uma ameaça ativa: porta interditada e nave perdida
            for (const outage of entry.timeline.outages) {
                const block = div('gantt-outage', track);
                block.style.left = this.percent(outage.start);
                block.style.width = this.percent(outage.end - outage.start);
                block.title = `Porta interditada: tick ${outage.start} a ${outage.end}`;
            }
            for (const [id, result] of entry.timeline.results) {
                if (result.killed === null) continue;
                const mark = div('gantt-kill', track);
                mark.style.left = this.percent(result.killed);
                mark.textContent = '✕';
                mark.title = result.revived === null
                    ? `${id} perdida no tick ${result.killed}`
                    : `${id} destruída no tick ${result.killed} e revivida no tick ${result.revived}`;
            }
            this.rows.set(entry.key, {name, track});
        }

        div('gantt-name-spacer', names);
        const axis = div('gantt-axis', this.tracks);
        const step = Math.max(1, Math.ceil(this.maxTicks / 13));
        for (let tick = 0; tick <= this.maxTicks; tick += step) {
            const mark = document.createElement('span');
            mark.textContent = String(tick);
            mark.style.left = this.percent(tick);
            axis.append(mark);
        }

        this.veil = div('gantt-veil', this.tracks);
        this.playhead = div('gantt-playhead', this.tracks);
        this.bindScrub();
    }

    percent(ticks) {
        return `${(ticks / this.maxTicks * 100).toFixed(3)}%`;
    }

    bindScrub() {
        const tickAt = event => {
            const box = this.tracks.getBoundingClientRect();
            return Math.round((event.clientX - box.left) / box.width * this.maxTicks);
        };
        let dragging = false;
        this.tracks.addEventListener('pointerdown', event => {
            dragging = true;
            this.tracks.setPointerCapture(event.pointerId);
            this.onSeek(tickAt(event));
        });
        this.tracks.addEventListener('pointermove', event => {
            if (dragging) this.onSeek(tickAt(event));
        });
        const stop = () => { dragging = false; };
        this.tracks.addEventListener('pointerup', stop);
        this.tracks.addEventListener('pointercancel', stop);
    }

    setActive(key) {
        for (const [rowKey, row] of this.rows) {
            const active = rowKey === key;
            row.name.classList.toggle('is-active', active);
            row.name.setAttribute('aria-pressed', String(active));
            row.track.classList.toggle('is-active', active);
        }
    }

    setTick(tick, animate) {
        if (!this.playhead) return;
        this.tracks.classList.toggle('no-anim', !animate);
        this.playhead.style.left = this.percent(tick);
        this.veil.style.left = this.percent(tick);
    }
}
