package br.inatel.promethean.scheduler;

/**
 * Escalonador Shortest Job First Preemptivo (SRTF).
 * Prioriza naves com menor tempo restante de processamento e realiza preempção
 * quando uma nave chega com tempo restante menor do que a atualmente atracada.
 */
public class SjfPreemptiveScheduler extends SJFScheduler {

    public SjfPreemptiveScheduler() {
        super(true);
    }
}
