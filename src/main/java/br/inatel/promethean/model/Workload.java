package br.inatel.promethean.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Carga de trabalho: o conjunto de naves (processos) que chega à estação.
 * A mesma carga é entregue a todos os escalonadores, para a comparação ser justa.
 */
public class Workload {

    private final List<SpaceCraft> spacecrafts; // Naves "molde": nunca são simuladas, só copiadas

    /**
     * Cria uma carga a partir de uma lista de naves
     *
     * @param spacecrafts naves que formam a carga
     */
    public Workload(List<SpaceCraft> spacecrafts) {
        this.spacecrafts = List.copyOf(spacecrafts); // copyOf retorna a lista imodificável
    }

    /**
     * Carga de referência: exemplo clássico de SJF dos livros de SO.
     * Os resultados esperados dela são calculados à mão e comparados com a saída do simulador
     *
     * N1: chegada 0, burst 8, prioridade 3
     * N2: chegada 1, burst 4, prioridade 1
     * N3: chegada 2, burst 9, prioridade 4
     * N4: chegada 3, burst 5, prioridade 2
     *
     * @return carga com as quatro naves de referência
     */
    public static Workload reference() {
        return new Workload(List.of(
                new SpaceCraft("N1", 0, 8, 3),
                new SpaceCraft("N2", 1, 4, 1),
                new SpaceCraft("N3", 2, 9, 4),
                new SpaceCraft("N4", 3, 5, 2)
        ));
    }

    // Métodos opcionais previstos na arquitetura

    public static Workload fromFile(String path){
        return null;
    }

    public static Workload random(int n, long seed){
        return null;
    }

    /**
     * Cria naves novas com os mesmos id, arrivalTime, burstTime e basePriority da carga.
     * A simulação altera a nave (remainingTime, estado, tempos), então cada algoritmo
     * precisa receber a sua própria cópia zerada
     *
     * @return lista nova, com naves em NEW e contadores zerados
     */
    public List<SpaceCraft> freshCopy(){
        List<SpaceCraft> copy = new ArrayList<>();
        for (SpaceCraft s : spacecrafts) {
            copy.add(new SpaceCraft(s.getId(), s.getArrivalTime(), s.getBurstTime(), s.getBasePriority()));
        }
        return copy;
    }
}
