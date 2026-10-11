package br.inatel.promethean.simulation;

import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.ProcessState;
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
        for (int i = 0; i < 3; i++) {
            admitArrivals();
            handleRunning();
            dispatchIdlePorts();
            advanceTime();
        }

        return null;
    }

    private void admitArrivals(){
        for (SpaceCraft spaceCraft : all) {
            if(spaceCraft.getArrivalTime() == clock && spaceCraft.getState() == ProcessState.NEW){
                spaceCraft.setState(ProcessState.READY);
                scheduler.addToReady(spaceCraft, clock);
                emit(EventType.ARRIVAL, spaceCraft, null);
            }
        }
    }

    private void handleRunning(){
        for (DockingPort port : ports) {
            if (!port.isIdle()) {
                SpaceCraft spaceCraft = port.getCurrent();
                if (spaceCraft.isFinished()) {
                    spaceCraft.setState(ProcessState.FINISHED);
                    spaceCraft.markFinish(clock);
                    port.undock();
                    emit(EventType.FINISH, spaceCraft, port);
                } else if (scheduler.shouldPreempt(spaceCraft, port, clock)) {
                    spaceCraft.setState(ProcessState.READY);
                    spaceCraft.resetPriority();
                    port.undock();
                    contextSwitches++;
                    scheduler.addToReady(spaceCraft, clock);
                    emit(EventType.PREEMPT, spaceCraft, port);
                }
            }
        }
    }

    private void dispatchIdlePorts(){
        for (DockingPort dockingPort : ports) {
            if (dockingPort.isIdle() && scheduler.hasReady()) {
                SpaceCraft spaceCraft = scheduler.selectNext(clock);
                spaceCraft.markStart(clock);
                dockingPort.dock(spaceCraft);
                emit(EventType.DISPATCH, spaceCraft, dockingPort);
            }
        }
    }

    private void advanceTime(){
        for (SpaceCraft spaceCraft : all) {
            if (spaceCraft.getState() == ProcessState.READY) {
                spaceCraft.waitTick();
            }
        }

        // Para portas em uso: o execute tick de uma nave atracada é chamado na porta
        for (DockingPort dockingPort : ports) {
            dockingPort.tick(); // ja verifica se a porta está em uso
        }

        clock++;
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
