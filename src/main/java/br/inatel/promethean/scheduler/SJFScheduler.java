package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

import java.util.ArrayDeque;
import java.util.Deque;

public class SJFScheduler implements Scheduler {

    private Deque<SpaceCraft> queue;
    private int boost;
    private int agingInterval;

    public SJFScheduler() {
        queue = new ArrayDeque<SpaceCraft>();
        boost = 1;
        agingInterval = 1;
    }

    public SJFScheduler(int boost, int agingInterval) {
        this.boost = boost;
        this.agingInterval = agingInterval;
        this.queue = new ArrayDeque<SpaceCraft>();
    }

    @Override
    public String name() {
        return "Shortest Job First";
    }

    @Override
    public void addToReady(SpaceCraft s, int now) {
        this.queue.addFirst(s);
    }

    @Override
    public boolean hasReady() {
        return queue.isEmpty();
    }

    @Override
    public SpaceCraft selectNext(int now) throws NullPointerException {
        if (!queue.isEmpty()) {
            int minBt = Integer.MAX_VALUE;
            SpaceCraft min = null;
            for (SpaceCraft c : queue) {
                int curBt = c.getBurstTime();
                if (curBt < minBt) {
                    minBt = curBt;
                    min = c;
                }
            }

            return min;
        }
        return null;
    }

    @Override
    public boolean shouldPreempt(SpaceCraft running, DockingPort port, int now) {
        for (SpaceCraft s : queue) {
            if (s.getCurrentPriority() < running.getCurrentPriority()) {
                return true; // Preempção
            }
        }
        return false;    }

    @Override
    public void onTick(int now) {
        for (SpaceCraft c : queue) {
            if(c.getCurrentPriority() > 0 && selectNext(now).getTimeInCurrentState() % agingInterval == 0)
                c.age(boost);
        }
    }
}
