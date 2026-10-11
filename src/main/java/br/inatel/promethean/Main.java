package br.inatel.promethean;

import br.inatel.promethean.model.SpaceCraft;
import br.inatel.promethean.model.Workload;
import br.inatel.promethean.scheduler.FcfsScheduler;
import br.inatel.promethean.scheduler.Scheduler;
import br.inatel.promethean.simulation.SimulationEngine;

import java.util.List;

public class Main {
    public static void main(String[] args) {
        Workload workload = Workload.reference();
        Scheduler scheduler = new FcfsScheduler();

        // O motor altera as naves que recebe; a lista fica guardada para ler os resultados depois
        List<SpaceCraft> spacecrafts = workload.freshCopy();

        SimulationEngine engine = new SimulationEngine(scheduler, 1, spacecrafts);
        engine.addListener(event -> System.out.println(event));

        System.out.println("Escalonador: " + scheduler.name());
        engine.run();

        // Tick em que cada nave atracou pela primeira vez e tick em que terminou
        System.out.println("Resultado:");
        for (SpaceCraft s : spacecrafts) {
            System.out.println(s.getId() + ": de " + s.getStartTime() + " a " + s.getFinishTime());
        }
    }
}
