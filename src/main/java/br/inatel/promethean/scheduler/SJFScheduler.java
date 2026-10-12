package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

import java.util.ArrayDeque;
import java.util.Deque;

public class SJFScheduler implements Scheduler {

    private Deque<SpaceCraft> queue;

    public SJFScheduler() {
        queue = new ArrayDeque<SpaceCraft>();
    }

    @Override
    public String name() {
        return "Shortest Job First";
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
     * Escolhe a nave de menor burstTime e a remove da fila de prontos.
     * Empate de burst: ganha quem tiver menor arrivalTime (ordem cronológica de chegada).
     *
     * @param now tick em que a escolha ocorre (não usado pelo SJF)
     * @return nave escolhida, ou null se a fila estiver vazia
     */
    @Override
    public SpaceCraft selectNext(int now) {
        if (!queue.isEmpty()) {
            SpaceCraft min = null;

            for (SpaceCraft c : queue) {
                if (min == null || c.getBurstTime() < min.getBurstTime()) {
                    min = c;
                }
                else if (c.getBurstTime() == min.getBurstTime()
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
        return false;
    }

    @Override
    public void onTick(int now) {

    }
}
