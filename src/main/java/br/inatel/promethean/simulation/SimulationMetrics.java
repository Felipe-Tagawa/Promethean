package br.inatel.promethean.simulation;

public record SimulationMetrics() {

    static String algorithm;
    static double avgWaitingTime;
    static double avgTurnaroundTime;
    static double avgResponseTime;
    static double throughput;
    static double contextSwitches;
}
