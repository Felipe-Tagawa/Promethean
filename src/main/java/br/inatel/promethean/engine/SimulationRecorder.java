package br.inatel.promethean.engine;

import br.inatel.promethean.model.SpaceCraft;
import br.inatel.promethean.model.Workload;
import br.inatel.promethean.scheduler.Scheduler;

import java.util.ArrayList;
import java.util.List;

/**
 * Roda uma simulação do começo ao fim e guarda tudo o que aconteceu nela.
 * O motor só devolve as métricas; os eventos saem um a um para os listeners.
 * Esta classe é o listener que os junta, para a tela poder reproduzir a simulação depois (replay).
 */
public final class SimulationRecorder {

    /** Versão do formato da gravação (campo "version" do contrato da tela). */
    public static final int FORMAT_VERSION = 1;

    private static final int PORT_COUNT = 1; // a tela desta entrega é desenhada para uma porta

    private SimulationRecorder() {
        // só métodos estáticos: não faz sentido criar um objeto desta classe
    }

    /**
     * Simula a carga de referência com o escalonador recebido e devolve a gravação completa.
     * Cada chamada usa uma cópia nova das naves e uma lista de eventos própria,
     * então dois pedidos ao mesmo tempo não interferem um no outro
     *
     * @param scheduler escalonador recém-criado; não pode ter sido usado em outra simulação
     * @return gravação com naves, portas, eventos e métricas
     */
    public static SimulationRecording recordSimulation(Scheduler scheduler) {
        // O motor altera as naves que recebe; a mesma lista vai na gravação
        List<SpaceCraft> spacecrafts = Workload.reference().freshCopy();
        SimulationEngine engine = new SimulationEngine(scheduler, PORT_COUNT, spacecrafts);

        // Listener que só guarda: a lista fica completa quando o run() termina
        List<SimulationEvent> events = new ArrayList<>();
        engine.addListener(event -> events.add(event));

        SimulationMetrics metrics = engine.run();

        return new SimulationRecording(FORMAT_VERSION, scheduler.name(), engine.getPortIds(), spacecrafts, events, metrics);
    }
}
