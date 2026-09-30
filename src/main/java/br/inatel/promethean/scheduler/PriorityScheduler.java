package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

import java.util.ArrayList;
import java.util.List;

public class PriorityScheduler implements Scheduler {

    private List<SpaceCraft> readyQueue = new ArrayList<>();
    private int agingInterval;
    private int agingBoost;

    public PriorityScheduler() {
        this(5, 1);
    }

    public PriorityScheduler(int agingInterval, int agingBoost) {
        this.agingInterval = agingInterval;
        this.agingBoost = agingBoost;
    }

    @Override
    public String name() {
        return "Priority with Aging";
    }

    @Override
    public void addToReady(SpaceCraft s, int now) {
        readyQueue.add(s);
    }

    @Override
    public boolean hasReady() {
        return !readyQueue.isEmpty();
    }

    @Override
    public SpaceCraft selectNext(int now) {
        if (readyQueue.isEmpty()) return null;

        int bestIndex = 0;
        SpaceCraft bestCraft = readyQueue.getFirst();

        for (int i = 1; i < readyQueue.size(); i++) {
            SpaceCraft candidate = readyQueue.get(i);
            if (candidate.getCurrentPriority() < bestCraft.getCurrentPriority()) {
                bestCraft = candidate;
                bestIndex = i;
            } else if (candidate.getCurrentPriority() == bestCraft.getCurrentPriority()) {
                // Menor Arrival Time
                if (candidate.getArrivalTime() < bestCraft.getArrivalTime()) {
                    bestCraft = candidate;
                    bestIndex = i;
                }
            }
        }

        readyQueue.remove(bestIndex);
        return bestCraft;
    }

    @Override
    public boolean shouldPreempt(SpaceCraft running, DockingPort port, int now) {
        for (SpaceCraft s : readyQueue) {
            if (s.getCurrentPriority() < running.getCurrentPriority()) {
                return true; // Preempção
            }
        }
        return false;
    }

    @Override
    public void onTick(int now) {
        for (SpaceCraft s : readyQueue) {
            if (s.getTimeInCurrentState() > 0 && s.getTimeInCurrentState() % agingInterval == 0) {
                s.age(agingBoost);
            }
        }
    }
}
