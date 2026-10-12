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
import br.inatel.promethean.sync.SharedReadyQueue;

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

        System.out.println("         Simulação de Escalonamento de CPU             ");

        for (Scheduler s: schedulers) {
            System.out.println("\n>>> Algoritmo: " + s.name() + " <<<");
            List<SpaceCraft> copy = workload.freshCopy();
            SimulationEngine engine = new SimulationEngine(s, 1, copy);
            engine.addListener(printer);
            SimulationMetrics metrics = engine.run();
            printer.print(metrics);
        }

        System.out.println("  Demonstração: SharedReadyQueue (Produtor/Consumidor)");
        SharedReadyQueue sharedQueue = new SharedReadyQueue();
        Thread producer = new Thread(() -> {
            try {
                Thread.sleep(100);
                System.out.println("  [Produtor] Produzindo e enfileirando nave N_PROD...");
                sharedQueue.enqueue(new SpaceCraft("N_PROD", 0, 5, 1));
            } catch (InterruptedException ignored) {}
        });
        Thread consumer = new Thread(() -> {
            try {
                System.out.println("  [Consumidor] Aguardando nave na SharedReadyQueue (bloqueado via Condition)...");
                SpaceCraft s = sharedQueue.dequeue();
                System.out.println("  [Consumidor] Nave " + s.getId() + " desenfileirada com sucesso!");
            } catch (InterruptedException ignored) {}
        });
        consumer.start();
        producer.start();
        try {
            producer.join();
            consumer.join();
        } catch (InterruptedException ignored) {}

        System.out.println("\n[Promethean] Sistema pronto e ouvindo na porta " + port);
    }
}
