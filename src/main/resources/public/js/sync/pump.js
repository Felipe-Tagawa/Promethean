// Fila de exibição: as threads emitem eventos em rajadas (um pedido e a concessão com 1 ms de diferença).
// Aqui eles são agrupados e mostrados com um intervalo mínimo, para dar tempo de ler cada passo.

const SETTLE_MS = 90; // espera para os eventos do mesmo passo chegarem juntos
const JOIN_MS = 60;   // eventos com timeMs mais próximos que isso viram um passo só

export class EventPump {

    /**
     * @param onBatch chamado com a lista de eventos de cada passo
     * @param minGapMs intervalo mínimo entre dois passos na tela
     */
    constructor(onBatch, minGapMs) {
        this.onBatch = onBatch;
        this.minGapMs = minGapMs;
        this.queue = [];
        this.timer = null;
        this.lastShown = 0;
    }

    push(event) {
        this.queue.push(event);
        this.schedule();
    }

    setGap(minGapMs) {
        this.minGapMs = minGapMs;
    }

    /** Descarta o que ainda não foi mostrado. */
    clear() {
        clearTimeout(this.timer);
        this.timer = null;
        this.queue = [];
        this.lastShown = 0;
    }

    schedule() {
        if (this.timer !== null) return;
        const sinceLast = performance.now() - this.lastShown;
        this.timer = setTimeout(() => this.flush(), Math.max(SETTLE_MS, this.minGapMs - sinceLast));
    }

    flush() {
        this.timer = null;
        if (this.queue.length === 0) return;

        const batch = [this.queue.shift()];
        while (this.queue.length > 0 && closeInTime(batch[batch.length - 1], this.queue[0])) {
            batch.push(this.queue.shift());
        }
        this.lastShown = performance.now();
        this.onBatch(batch);
        if (this.queue.length > 0) this.schedule();
    }
}

function closeInTime(a, b) {
    if (a.type === 'SYNC_START' || b.type === 'SYNC_START') return false;
    if (typeof a.timeMs !== 'number' || typeof b.timeMs !== 'number') return false;
    return b.timeMs - a.timeMs <= JOIN_MS;
}
