package br.inatel.promethean.simulation;

public record SimulationMetrics(String algorithm,
                                double avgWaitingTime,
                                double avgTurnaroundTime,
                                double avgResponseTime,
                                double throughput,
                                double contextSwitches) {}
