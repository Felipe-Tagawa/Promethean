package br.inatel.promethean.simulation;

public class ConsoleGanttPrinter implements SimulationListener {

    @Override
    public void onEvent(SimulationEvent event) {

    }

    public void print(SimulationMetrics metrics){
        System.out.println("Algorithm: " + metrics.algorithm());
        System.out.println("Average Waiting Time: " + metrics.avgWaitingTime());
        System.out.println("Average Response Time: " + metrics.avgResponseTime());
        System.out.println("Context Switches: " + metrics.contextSwitches());
        System.out.println("Throughput: " + metrics.throughput());
        System.out.println("Average Turnaround Time: " + metrics.avgTurnaroundTime());
    }
}
