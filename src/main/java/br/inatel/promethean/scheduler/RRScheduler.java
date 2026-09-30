package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

import java.util.Deque;

public class RRScheduler implements Scheduler {

    private Deque<SpaceCraft> queue;
    private int quantum;

    @Override
    public String name() {
        return "";
    }

    @Override
    public void addToReady(SpaceCraft s, int now) {

    }

    @Override
    public boolean hasReady() {
        return false;
    }

    @Override
    public SpaceCraft selectNext(int now) {
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
