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
        listeners = new ArrayList<>();
        this.scheduler = scheduler;
        this.ports = new ArrayList<>();
        for (int i = 1; i <= portCount; i++) {
            this.ports.add(new DockingPort("P" + i));
        }
        this.all = new ArrayList<>(spacecrafts);
        this.clock = 0;
        this.contextSwitchCost = 0;
        this.contextSwitches = 0;
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
        // em arrival ainda não tem porta, por isso P é null (tratamento para nao lançar nullpointerexcept)
        String portId = (p == null) ? null : p.getId();
        SimulationEvent event = new SimulationEvent(clock, type, s.getId(), portId);
        for (SimulationListener listener : listeners) {
            listener.onEvent(event);
        }
    }

}
