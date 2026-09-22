package br.inatel.promethean.model;

public class SpaceCraft {

    private final String id;
    private final float arrivalTime, burstTime, remainingTime;
    private final int basePriority; // Quanto menor, maior prioridade
    private int currentPriority;
    private float waitingTime = 0, startTime = -1, finishTime = -1, timeInCurrentState = 0;
    private ProcessState state;

    public SpaceCraft(String id, float arrivalTime, float burstTime, float remainingTime, int basePriority) {
        this.id = id;
        this.arrivalTime = arrivalTime;
        this.burstTime = burstTime;
        this.remainingTime = remainingTime;
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
