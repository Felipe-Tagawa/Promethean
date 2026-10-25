package br.inatel.promethean.engine;

import br.inatel.promethean.model.SpaceCraft;

import java.util.List;

/**
 * Gravação de uma simulação completa, no formato que a tela de escalonamento espera
 * (seção 3.2 de docs/frontend/README.md). Vira JSON direto: cada campo é uma chave com o mesmo nome.
 *
 * @param version versão do formato; a tela foi escrita para a versão 1
 * @param algorithm nome do algoritmo, o mesmo de Scheduler.name()
 * @param workload qual carga foi simulada (com a semente, se for a aleatória), para o resultado poder ser reproduzido
 * @param ports ids das portas, na ordem em que aparecem na tela
 * @param spacecrafts naves da carga. A tela usa id, name, arrivalTime, burstTime e basePriority e ignora o resto
 * @param events todos os eventos, na ordem em que o motor os emitiu
 * @param metrics médias e contadores calculados ao fim da simulação
 */
public record SimulationRecording(int version,
                                  String algorithm,
                                  WorkloadInfo workload,
                                  List<String> ports,
                                  List<SpaceCraft> spacecrafts,
                                  List<SimulationEvent> events,
                                  SimulationMetrics metrics) {

    /**
     * Identificação da carga simulada
     *
     * @param key chave da carga ("aleatoria" para a sorteada)
     * @param title nome curto da carga
     * @param universe universo da tela a que ela pertence; null na aleatória
     * @param seed semente da carga aleatória; null nas de arquivo
     */
    public record WorkloadInfo(String key, String title, String universe, Long seed) {}
}
