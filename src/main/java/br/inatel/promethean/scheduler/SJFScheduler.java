package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

import java.util.ArrayDeque;
import java.util.Deque;

public class SJFScheduler implements Scheduler {

    private final Deque<SpaceCraft> queue;
    private final boolean preemptive;

    public SJFScheduler() {
        this(false);
    }

    public SJFScheduler(boolean preemptive) {
        this.queue = new ArrayDeque<SpaceCraft>();
        this.preemptive = preemptive;
    }

    @Override
    public String name() {
        return preemptive ? "SJF Preemptivo" : "Shortest Job First";
    }

    /**
     * Coloca a nave no fim da fila de prontos (órbita de espera).
     * É chamado em toda entrada em READY: chegada, preempção ou desbloqueio
     *
     * @param s nave que ficou pronta
     * @param now tick em que isso ocorreu (não usado pelo SJF)
     */
    @Override
    public void addToReady(SpaceCraft s, int now) {
        this.queue.addLast(s);
    }

    /**
     * Checa se existe alguma nave na fila de prontos
     *
     * @return True = há nave esperando False = fila vazia
     */
    @Override
    public boolean hasReady() {
        return !queue.isEmpty();
    }

    /**
     * Escolhe a nave com menor tempo e a remove da fila de prontos.
     * No modo preemptivo, considera o tempo restante (remainingTime).
     * No modo não preemptivo, considera a duração total (burstTime).
     * Empate: ganha quem tiver menor arrivalTime (ordem cronológica de chegada).
     *
     * @param now tick em que a escolha ocorre (não usado pelo SJF)
     * @return nave escolhida, ou null se a fila estiver vazia
     */
    @Override
    public SpaceCraft selectNext(int now) {
        if (!queue.isEmpty()) {
            SpaceCraft min = null;

            for (SpaceCraft c : queue) {
                int cTime = preemptive ? c.getRemainingTime() : c.getBurstTime();
                int minTime = (min != null) ? (preemptive ? min.getRemainingTime() : min.getBurstTime()) : 0;

                if (min == null || cTime < minTime) {
                    min = c;
                }
                else if (cTime == minTime
                        && c.getArrivalTime() < min.getArrivalTime()) {
                    min = c;
                }
            }

            queue.remove(min);

            return min;
        }
        return null;
    }

    @Override
    public boolean shouldPreempt(SpaceCraft running, DockingPort port, int now) {
        if (!preemptive) {
            return false;
        }
        for (SpaceCraft s : queue) {
            if (s.getRemainingTime() < running.getRemainingTime()) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void onTick(int now) {

    }

    public boolean isPreemptive() {
        return preemptive;
    }
}
