package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

import java.util.ArrayDeque;
import java.util.Deque;

public class FcfsScheduler implements Scheduler {

    private Deque<SpaceCraft> queue = new ArrayDeque<>();

    @Override
    public String name() {
        return "FCFS";
    }

    @Override
    public void addToReady(SpaceCraft s, int now) {
        queue.addLast(s);
    }

    @Override
    public boolean hasReady() {
        return !queue.isEmpty();
    }

    @Override
    public SpaceCraft selectNext(int now) {
        return queue.pollFirst(); // Retirar quem está mais tempo esperando
    }

    // Sempre Falso para FCFS
    @Override
    public boolean shouldPreempt(SpaceCraft running, DockingPort port, int now) {
        return false;
    }

    @Override
    public void onTick(int now) {
        // Não faz nada - Não possui Aging
    }
}
