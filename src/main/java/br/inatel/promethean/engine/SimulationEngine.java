package br.inatel.promethean.engine;

import br.inatel.promethean.exception.SimulationTimeoutException;
import br.inatel.promethean.model.DockingPort;
import br.inatel.promethean.model.ProcessState;
import br.inatel.promethean.model.SpaceCraft;
import br.inatel.promethean.scheduler.Scheduler;

import java.util.ArrayList;
import java.util.List;

public class SimulationEngine {

    // Limite de segurança: nenhuma carga real chega perto disso, então passar daqui indica laço infinito
    private static final int MAX_TICKS = 1000;

    private Scheduler scheduler;
    private List<DockingPort> ports;
    private List<SpaceCraft> all;
    private int clock;
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
        this.contextSwitches = 0;
    }

    public void addListener(SimulationListener listener) {
        listeners.add(listener);
    }

    /**
     * Ids das portas, na ordem em que foram criadas (P1, P2, ...).
     * Quem monta a gravação para a tela usa esta lista em vez de repetir a regra dos nomes
     *
     * @return lista nova com o id de cada porta
     */
    public List<String> getPortIds() {
        List<String> ids = new ArrayList<>();
        for (DockingPort port : ports) {
            ids.add(port.getId());
        }
        return ids;
    }

    public SimulationMetrics run(){
        while (!isAllFinished(all)){
            // Um erro de escalonador (nave que nunca termina) vira exceção em vez de travar o programa
            if (clock > MAX_TICKS) {
                throw new SimulationTimeoutException("Simulation passed " + MAX_TICKS + " ticks with scheduler '"
                        + scheduler.name() + "': some spacecraft never finishes.");
            }

            admitArrivals();
            scheduler.onTick(clock); // manutenção do escalonador (aging); precisa vir antes da decisão de preempção
            handleRunning();
            dispatchIdlePorts();
            advanceTime();
        }

        double totalWaiting = 0;
        double totalTurnaround = 0;
        double totalResponse = 0;

        for (SpaceCraft s: all) {
            totalWaiting += s.getWaitingTime();
            totalTurnaround += s.getTurnaroundTime();
            totalResponse += s.getResponseTime();
        }

        int n = all.size();
        double avgWaiting = totalWaiting / n;
        double avgTurnaround = totalTurnaround / n;
        double avgResponse = totalResponse / n;
        int totalTime = all.stream().
        mapToInt(SpaceCraft::getFinishTime).max().orElse(clock);
        
        double throughput = (totalTime > 0) ? (double) n / totalTime : 0.0;
        
        return new SimulationMetrics(
            scheduler.name(),
            avgWaiting,
            avgTurnaround,
            avgResponse,
            throughput,
            (double) contextSwitches
        );
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

    private boolean isAllFinished(List<SpaceCraft> spacecrafts){
        boolean finished = true;
        for (SpaceCraft spaceCraft : spacecrafts) {
            if(spaceCraft.getState() != ProcessState.FINISHED){
                finished = false;
            }
        }

        return finished;
    }

}
