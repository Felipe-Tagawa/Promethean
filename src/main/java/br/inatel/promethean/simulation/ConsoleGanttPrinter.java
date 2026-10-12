package br.inatel.promethean.simulation;

import java.util.ArrayList;
import java.util.List;

public class ConsoleGanttPrinter implements SimulationListener {

    private final List<SimulationEvent> events = new ArrayList<>();

    @Override
    public void onEvent(SimulationEvent event) {
        events.add(event);
    }

    public void print(SimulationMetrics metrics){
        System.out.println("  Linha do tempo (Eventos):");
        for (SimulationEvent e : events) {
            String portInfo = (e.portId() != null && !e.portId().isEmpty()) ? " na porta " + e.portId() : "";
            System.out.printf("    [Tick %2d] %-8s : Nave %s%s%n", e.tick(), e.type(), e.spaceCraftId(), portInfo);
        }

        System.out.println("\n  Diagrama de Gantt:");
        StringBuilder gantt = new StringBuilder("  ");
        for (SimulationEvent e : events) {
            if (e.type() == EventType.DISPATCH) {
                gantt.append("[").append(e.spaceCraftId()).append(" (t=").append(e.tick()).append(")] ");
            }
        }
        System.out.println(gantt);

        System.out.println("\n  Métricas:");
        System.out.printf("    Tempo Médio de Espera:      %.2f%n", metrics.avgWaitingTime());
        System.out.printf("    Tempo Médio de Resposta:    %.2f%n", metrics.avgResponseTime());
        System.out.printf("    Tempo Médio de Retorno:     %.2f%n", metrics.avgTurnaroundTime());
        System.out.printf("    Trocas de Contexto:         %.0f%n", metrics.contextSwitches());
        System.out.printf("    Vazão (Throughput):         %.4f naves/tick%n", metrics.throughput());

        events.clear();
    }
}
