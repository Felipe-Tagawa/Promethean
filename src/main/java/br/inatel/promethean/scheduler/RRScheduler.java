package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

import java.util.Deque;

public class RRScheduler implements Scheduler {

    private Deque<SpaceCraft> queue;
    private int quantum;

    @Override
    public String name() {
        return "Round robin";
    }

    @Override
    public void addToReady(SpaceCraft s, int now) {
        this.queue.addFirst(s);
    }

    @Override
    public boolean hasReady() {
        for (SpaceCraft s : queue) {

        }

        return false;
    }

    @Override
    public SpaceCraft selectNext(int now) {
        if (!queue.isEmpty()) {
            return queue.removeFirst();
        }
        return null;
    }

    @Override
    public boolean shouldPreempt(SpaceCraft running, DockingPort port, int now) {
        return false;
    }

    @Override
    public void onTick(int now) {
        for (SpaceCraft s : queue) {

        }
    }
}
