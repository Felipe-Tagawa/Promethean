package br.inatel.promethean.model;

public class DockingPort {

    private final String id;
    private SpaceCraft currentSpaceCraft; // Processo alocado

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
    }

    // Dispatcher: port.dock(next)

    // Desalocação

    public SpaceCraft undock() {
        SpaceCraft departing = this.currentSpaceCraft;
        this.currentSpaceCraft = null;
        return departing;
    }

    // Método para executar ciclos de clock

    public void tick() {
        if (this.currentSpaceCraft != null) {
            currentSpaceCraft.executeTick();
        }
    }

    public SpaceCraft getCurrent() {
        return currentSpaceCraft;
    }

    public String getId() {
        return id;
    }
}
