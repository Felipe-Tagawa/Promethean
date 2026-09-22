package br.inatel.promethean.model;

public class DockingPort {

    private final String id;
    private SpaceCraft currentSpaceCraft; // Processo alocado

    // Todo: Implementar contador de ticks e contador de quantum do Round Robin
    private int quantumTime = 0;

    public DockingPort(String id, SpaceCraft currentSpaceCraft) {
        this.id = id;
        this.currentSpaceCraft = null;
    }

    public boolean isIdle() {
        return this.currentSpaceCraft == null;
    }

    // Alocação

    public void dock(SpaceCraft spaceCraft) {
        this.currentSpaceCraft = spaceCraft;
        this.currentSpaceCraft.setState((ProcessState.RUNNING));
        this.quantumTime = 0;
    }

    // Dispatcher: port.dock(next)

    // Desalocação

    public SpaceCraft undock() {
        SpaceCraft departing = this.currentSpaceCraft;
        this.currentSpaceCraft = null;
        this.quantumTime = 0;
        return departing;
    }

    // Método para executar ciclos de clock


    public String getId() {
        return id;
    }

    public int getQuantumTime() {
        return quantumTime;
    }
}
