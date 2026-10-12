package br.inatel.promethean;

import java.util.List;

import br.inatel.promethean.model.SpaceCraft;
import br.inatel.promethean.model.Workload;
import br.inatel.promethean.scheduler.FcfsScheduler;
import br.inatel.promethean.scheduler.PriorityScheduler;
import br.inatel.promethean.scheduler.SJFScheduler;
import br.inatel.promethean.scheduler.Scheduler;
import br.inatel.promethean.server.WebSocketServer;
import br.inatel.promethean.simulation.ConsoleGanttPrinter;
import br.inatel.promethean.simulation.SimulationEngine;
import br.inatel.promethean.simulation.SimulationMetrics;

public class Main {
    public static void main(String[] args) {
        int port = System.getenv("PORT") != null ? Integer.parseInt(System.getenv("PORT")) : 7070;
        new WebSocketServer().start(port);

        Workload workload = Workload.reference();

        List<Scheduler> schedulers = List.of(
            new FcfsScheduler(),
            new SJFScheduler(),
            new PriorityScheduler()
        );

        ConsoleGanttPrinter printer = new ConsoleGanttPrinter();

        System.out.println("Simulação de Escalonamento de CPU");

        for (Scheduler s: schedulers) {
        List<SpaceCraft> copy = workload.freshCopy();
            SimulationEngine engine = new SimulationEngine(s, 1, copy);
            SimulationMetrics metrics = engine.run();
            printer.print(metrics);
        }
    }
}
