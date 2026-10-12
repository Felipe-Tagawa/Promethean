package br.inatel.promethean;

import br.inatel.promethean.model.SpaceCraft;
import br.inatel.promethean.model.Workload;
import br.inatel.promethean.scheduler.SJFScheduler;
import br.inatel.promethean.scheduler.Scheduler;
import br.inatel.promethean.server.WebSocketServer;

import java.util.List;

public class Main {
    public static void main(String[] args) {

        new WebSocketServer().start(7070);

        Workload workload = Workload.reference();
        Scheduler sjfscheduler = new SJFScheduler();

        // Ainda não há motor nem clock: todas as naves entram na órbita no mesmo instante
        int now = 0;

        // Momento de chegada
        List<SpaceCraft> spacecrafts = workload.freshCopy(); // spacecrafts para o SJF
        for (SpaceCraft s : spacecrafts) {
            sjfscheduler.addToReady(s, now);
        }

        System.out.println("Escalonador: " + sjfscheduler.name());
        System.out.println("Ordem de escolha:");

        // Esvazia a fila de prontos, uma escolha por volta
        while (sjfscheduler.hasReady()) {
            SpaceCraft next = sjfscheduler.selectNext(now);
            System.out.println(next.getId());
        }
    }
}
