package br.inatel.promethean.engine;

import br.inatel.promethean.model.SpaceCraft;

import java.util.List;

/**
 * Gravação de uma simulação completa, no formato que a tela de escalonamento espera
 * (seção 3.2 de docs/frontend/README.md). Vira JSON direto: cada campo é uma chave com o mesmo nome.
 *
 * @param version versão do formato; a tela foi escrita para a versão 1
 * @param algorithm nome do algoritmo, o mesmo de Scheduler.name()
 * @param ports ids das portas, na ordem em que aparecem na tela
 * @param spacecrafts naves da carga. A tela usa id, arrivalTime, burstTime e basePriority e ignora o resto
 * @param events todos os eventos, na ordem em que o motor os emitiu
 * @param metrics médias e contadores calculados ao fim da simulação
 */
public record SimulationRecording(int version,
                                  String algorithm,
                                  List<String> ports,
                                  List<SpaceCraft> spacecrafts,
                                  List<SimulationEvent> events,
                                  SimulationMetrics metrics) {}
