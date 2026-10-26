package br.inatel.promethean;

import java.util.List;

import br.inatel.promethean.model.SpaceCraft;
import br.inatel.promethean.model.Workload;
import br.inatel.promethean.model.WorkloadCatalog;
import br.inatel.promethean.scheduler.SchedulerCatalog;
import br.inatel.promethean.engine.SimulationRecorder;
import br.inatel.promethean.scheduler.FcfsScheduler;
import br.inatel.promethean.scheduler.PriorityScheduler;
import br.inatel.promethean.scheduler.SJFScheduler;
import br.inatel.promethean.scheduler.SjfPreemptiveScheduler;
import br.inatel.promethean.scheduler.Scheduler;
import br.inatel.promethean.server.WebSocketServer;
import br.inatel.promethean.engine.SimulationEngine;
import br.inatel.promethean.engine.SimulationMetrics;
import br.inatel.promethean.sync.SharedReadyQueue;
import br.inatel.promethean.view.ConsoleGanttPrinter;

public class Main {
    public static void main(String[] args) {
        int port = System.getenv("PORT") != null ? Integer.parseInt(System.getenv("PORT")) : 7070;
        new WebSocketServer().start(port);

        Workload workload = Workload.reference();

        List<Scheduler> schedulers = List.of(
            new FcfsScheduler(),
            new SJFScheduler(),
            new SjfPreemptiveScheduler(),
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

        // Todas as cargas de arquivo, cada uma rodada nos mesmos algoritmos: a comparação é justa dentro da carga
        System.out.println("\n         Comparação por carga (a mesma carga em todos os algoritmos)          ");
        for (String key : WorkloadCatalog.keys()) {
            printComparison(Workload.fromFile(key));
        }

        System.out.println("\n  Demonstração: SharedReadyQueue (Produtor/Consumidor)");
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

    /**
     * Imprime uma tabela com as métricas da carga em cada algoritmo do catálogo.
     * Cada linha usa um escalonador novo e uma cópia nova das naves, então nenhuma simulação interfere na outra
     */
    private static void printComparison(Workload workload) {
        System.out.printf("%n  %s (%s) · %d naves%n", workload.getTitle(), workload.getKey(), workload.getSpacecrafts().size());
        System.out.printf("    %-22s %8s %11s %9s %7s %8s%n", "Algoritmo", "Espera", "Turnaround", "Resposta", "Trocas", "Vazão");
        for (SchedulerCatalog.Entry entry : SchedulerCatalog.list()) {
            SimulationMetrics m = SimulationRecorder.recordSimulation(SchedulerCatalog.create(entry.key()), workload).metrics();
            System.out.printf("    %-22s %8.2f %11.2f %9.2f %7.0f %8.4f%n", entry.name(),
                    m.avgWaitingTime(), m.avgTurnaroundTime(), m.avgResponseTime(), m.contextSwitches(), m.throughput());
        }
    }
}
