package br.inatel.promethean.scheduler;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;

public class FcfsScheduler implements Scheduler {
    @Override
    public void onArrival(SpaceCraft s, int now) {

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
