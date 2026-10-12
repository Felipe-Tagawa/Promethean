package br.inatel.promethean.scheduler;

import br.inatel.promethean.exception.InvalidValueException;

import java.util.ArrayList;
import java.util.List;

/**
 * Catálogo dos algoritmos de escalonamento disponíveis.
 * É a única fonte das chaves usadas pela tela ("fcfs", "sjf", "priority"):
 * a lista mostrada no seletor e a criação do escalonador saem daqui.
 */
public final class SchedulerCatalog {

    /** Algoritmo usado quando o pedido não diz qual quer. */
    public static final String DEFAULT_KEY = "fcfs";

    // Para acrescentar um algoritmo: incluir a chave aqui e o caso correspondente em create()
    private static final List<String> KEYS = List.of("fcfs", "sjf", "priority");

    /**
     * Um algoritmo do catálogo
     *
     * @param key chave usada no parâmetro "algorithm" da URL
     * @param name nome para exibição, o mesmo de Scheduler.name()
     */
    public record Entry(String key, String name) {}

    private SchedulerCatalog() {
        // só métodos estáticos: não faz sentido criar um objeto desta classe
    }

    /**
     * Lista os algoritmos disponíveis, na ordem em que aparecem na tela
     *
     * @return uma entrada (chave e nome) por algoritmo
     */
    public static List<Entry> list() {
        List<Entry> entries = new ArrayList<>();
        for (String key : KEYS) {
            entries.add(new Entry(key, create(key).name()));
        }
        return entries;
    }

    /**
     * Cria um escalonador novo a partir da chave.
     * Cada simulação precisa do seu, porque o escalonador guarda a fila de prontos dentro dele
     *
     * @param key chave do algoritmo, sem diferenciar maiúsculas; null ou vazia vale DEFAULT_KEY
     * @return escalonador recém-criado, com a fila vazia
     * @throws InvalidValueException se a chave não estiver no catálogo
     */
    public static Scheduler create(String key) {
        String normalized = (key == null || key.isBlank()) ? DEFAULT_KEY : key.trim().toLowerCase();
        return switch (normalized) {
            case "fcfs" -> new FcfsScheduler();
            case "sjf" -> new SJFScheduler();
            case "priority" -> new PriorityScheduler();
            default -> throw new InvalidValueException(
                    "Unknown scheduling algorithm '" + key + "'. Available: " + String.join(", ", KEYS) + ".");
        };
    }
}
