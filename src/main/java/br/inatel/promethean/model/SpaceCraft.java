package br.inatel.promethean.model;

public class SpaceCraft {
    /**
     * Id: Id do processo
     * arrivalTime: momento em que o processo fica pronto
     * burstTime: tempo total de CPU que o processo precisa
     * remainingTime: quanto de CPU ainda falta (diminui a cada tick)
     * basePriority: prioridade original
     * currentPriority: prioridade efetiva, é alterada pelo aging
     * state: estado no ciclo de vida
     * waitingTime: tempo acumulado do processo em ready
     * startTime: primeira vez que ganhou uma cpu
     * finishTime: momento em que o processo terminou
     * timeInCurrentStates: há quanto tempo está no estado atual
     */

    private final String id;
    private final float arrivalTime, burstTime;
    private float remainingTime;
    private final int basePriority; // Quanto menor, maior prioridade
    private int currentPriority;
    private int waitingTime = 0, startTime = -1, finishTime = -1, timeInCurrentState = 0;
    private ProcessState state;

    public SpaceCraft(String id, float arrivalTime, float burstTime, int basePriority) {
        this.id = id;
        this.arrivalTime = arrivalTime;
        this.burstTime = burstTime;
        this.remainingTime = burstTime;
        this.basePriority = basePriority;
        this.currentPriority = basePriority;
        this.state = ProcessState.NEW;
    }

    public String getId() { return id; }

    public float getArrivalTime() { return arrivalTime; }

    public float getBurstTime() { return burstTime; }

    public float getRemainingTime() { return remainingTime; }

    public int getBasePriority() { return basePriority; }

    public int getCurrentPriority() { return currentPriority; }

    public ProcessState getState() { return state; }

    public void setState(ProcessState state) { this.state = state; this.timeInCurrentState = 0; }

    public float getWaitingTime() { return waitingTime; }

    public float getStartTime() { return startTime; }

    public float getFinishTime() { return finishTime; }

    public float getTimeInCurrentState() { return timeInCurrentState; }

    @Override
    public String toString() {
        return String.format("[%s | Pri:%d (Base:%d) | Rem:%f/%f | State:%s]",
                id, currentPriority, basePriority, remainingTime, burstTime, state);
    }
}
