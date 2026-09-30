package br.inatel.promethean.simulation;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.SpaceCraft;
import br.inatel.promethean.scheduler.Scheduler;

import java.util.ArrayList;
import java.util.List;

public class SimulationEngine {

    private Scheduler scheduler;
    private List<DockingPort> ports;
    private List<SpaceCraft> all;
    private int clock;
    private int contextSwitchCost;
    private int contextSwitches;
    private List<SimulationListener> listeners;

    public SimulationEngine(Scheduler scheduler, int portCount, List<SpaceCraft> spacecrafts) {
    }

    public void addListener(SimulationListener listener) {
        listeners.add(listener);
    }

    public SimulationMetrics run(){
        return null;
    }

    private void admitArrivals(){

    }

    private void handleRunning(){

    }

    private void dispatchIdlePorts(){

    }

    private void advanceTime(){

    }

    private void emit(EventType type, SpaceCraft s, DockingPort p){

    }

}
