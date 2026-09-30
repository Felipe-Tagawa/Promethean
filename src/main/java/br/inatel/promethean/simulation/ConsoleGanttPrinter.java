package br.inatel.promethean.simulation;

public class ConsoleGanttPrinter implements SimulationListener {

    @Override
    public void onEvent(SimulationEvent event) {

    }

    public void print() {
        System.out.println("Algorithm: " + SimulationMetrics.algorithm);
        System.out.println("Average Waiting Time: " + SimulationMetrics.avgWaitingTime);
        System.out.println("Average Response Time: " + SimulationMetrics.avgResponseTime);
        System.out.println("Context Switches: " + SimulationMetrics.contextSwitches);
        System.out.println("Throughput: " + SimulationMetrics.throughput);
        System.out.println("Average Turnaround Time: " + SimulationMetrics.avgTurnaroundTime);
    }
}
