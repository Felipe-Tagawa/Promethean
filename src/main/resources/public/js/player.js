// Controla o tick atual do replay: reproduzir, pausar, passo a passo, velocidade e salto.

const BASE_TICK_MS = 900; // duração de um tick na velocidade 1×

export class Player {

    /**
     * @param onChange chamado a cada mudança com {tick, total, playing, animate, tickMs}
     */
    constructor(onChange) {
        this.onChange = onChange;
        this.tick = 0;
        this.total = 0;
        this.speed = 1;
        this.playing = false;
        this.timer = null;
    }

    get tickMs() {
        return BASE_TICK_MS / this.speed;
    }

    /** Troca de simulação: volta ao tick 0, pausado. */
    load(total) {
        this.stopTimer();
        this.playing = false;
        this.total = total;
        this.tick = 0;
        this.emit(false);
    }

    play() {
        if (this.playing || this.total === 0) return;
        if (this.tick >= this.total) {
            this.tick = 0;
            this.emit(false);
        }
        this.playing = true;
        this.emit(false);
        this.schedule();
    }

    pause() {
        if (!this.playing) return;
        this.stopTimer();
        this.playing = false;
        this.emit(false);
    }

    toggle() {
        if (this.playing) this.pause(); else this.play();
    }

    /** Avança ou recua um tick, com animação. Pausa a reprodução. */
    step(delta) {
        this.stopTimer();
        this.playing = false;
        this.tick = clamp(this.tick + delta, 0, this.total);
        this.emit(true);
    }

    /** Salta direto para um tick, sem animação. Pausa a reprodução. */
    seek(tick) {
        this.stopTimer();
        this.playing = false;
        this.tick = clamp(Math.round(tick), 0, this.total);
        this.emit(false);
    }

    setSpeed(speed) {
        this.speed = speed;
        if (this.playing) {
            this.stopTimer();
            this.schedule();
        }
        this.emit(false);
    }

    schedule() {
        this.timer = setTimeout(() => {
            this.tick++;
            if (this.tick >= this.total) {
                this.tick = this.total;
                this.playing = false;
                this.timer = null;
            } else {
                this.schedule();
            }
            this.emit(true);
        }, this.tickMs);
    }

    stopTimer() {
        clearTimeout(this.timer);
        this.timer = null;
    }

    emit(animate) {
        this.onChange({tick: this.tick, total: this.total, playing: this.playing, animate, tickMs: this.tickMs});
    }
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
