package br.inatel.promethean.model;

public class DockingPort {

    private final String id;
    private SpaceCraft currentSpaceCraft; // Processo alocado

    // Todo: Implementar contador de ticks e contador de quantum do Round Robin
    private int quantumUsed = 0;

    public DockingPort(String id) {
        this.id = id;
    }

    public boolean isIdle() {
        return this.currentSpaceCraft == null;
    }

    // Alocação

    public void dock(SpaceCraft spaceCraft) {
        this.currentSpaceCraft = spaceCraft;
        this.currentSpaceCraft.setState((ProcessState.RUNNING));
        this.quantumUsed = 0;
    }

    // Dispatcher: port.dock(next)

    // Desalocação

    public SpaceCraft undock() {
        SpaceCraft departing = this.currentSpaceCraft;
        this.currentSpaceCraft = null;
        this.quantumUsed = 0;
        return departing;
    }

    // Método para executar ciclos de clock

    public void tick() {
        if (this.currentSpaceCraft != null) {
            this.quantumUsed++;
        }
    }

    public SpaceCraft getCurrentSpaceCraft() {
        return currentSpaceCraft;
    }

    public int getQuantumTime() {
        return quantumUsed;
    }
}
