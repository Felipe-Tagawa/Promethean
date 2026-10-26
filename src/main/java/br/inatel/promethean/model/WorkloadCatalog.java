package br.inatel.promethean.model;

import br.inatel.promethean.exception.InvalidValueException;
import com.fasterxml.jackson.core.type.TypeReference;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Catálogo das cargas disponíveis. A lista vem de public/workloads/index.json,
 * o mesmo arquivo que a tela lê no modo demonstração: uma fonte só para o Java e para a tela.
 * Para acrescentar uma carga: criar o <chave>.json na pasta e incluir a chave no índice.
 */
public final class WorkloadCatalog {

    /** Carga usada quando o pedido não diz qual quer. */
    public static final String DEFAULT_KEY = "referencia";

    /**
     * Resumo de uma carga, para o seletor da tela
     *
     * @param key chave usada no parâmetro "workload" da URL
     * @param title nome curto da carga
     * @param universe universo da tela a que ela pertence
     * @param description o que a carga mostra
     * @param ships número de naves
     */
    public record Entry(String key, String title, String universe, String description, int ships) {}

    private WorkloadCatalog() {
        // só métodos estáticos: não faz sentido criar um objeto desta classe
    }

    /**
     * Chaves das cargas de arquivo, na ordem do seletor
     *
     * @return lista imutável lida do index.json
     */
    public static List<String> keys() {
        try (InputStream in = WorkloadCatalog.class.getResourceAsStream(Workload.FOLDER + "index.json")) {
            if (in == null) {
                throw new InvalidValueException("Missing workload index '" + Workload.FOLDER + "index.json'.");
            }
            return List.copyOf(Workload.JSON.readValue(in, new TypeReference<List<String>>() {}));
        } catch (IOException e) {
            throw new InvalidValueException("Workload index is invalid: " + e.getMessage());
        }
    }

    /**
     * Resume cada carga do índice, na mesma ordem
     *
     * @return uma entrada por carga de arquivo (a aleatória não entra: ela é montada na hora)
     */
    public static List<Entry> list() {
        List<Entry> entries = new ArrayList<>();
        for (String key : keys()) {
            Workload w = Workload.fromFile(key);
            entries.add(new Entry(w.getKey(), w.getTitle(), w.getUniverse(), w.getDescription(), w.getSpacecrafts().size()));
        }
        return entries;
    }

    /**
     * Monta a carga pedida: uma do índice ou a aleatória.
     * Só aceita chaves do índice, então um pedido não consegue ler outro arquivo do classpath
     *
     * @param key chave da carga; null ou vazia vale DEFAULT_KEY; "aleatoria" sorteia uma carga
     * @param seed semente, obrigatória na aleatória e ignorada nas outras
     * @param ships número de naves, obrigatório na aleatória e ignorado nas outras
     * @return a carga, já validada
     * @throws InvalidValueException se a chave não existir ou faltar semente ou número de naves na aleatória
     */
    public static Workload create(String key, Long seed, Integer ships) {
        String normalized = (key == null || key.isBlank()) ? DEFAULT_KEY : key.trim().toLowerCase();

        if (Workload.RANDOM_KEY.equals(normalized)) {
            if (seed == null || ships == null) {
                throw new InvalidValueException("The random workload needs 'seed' and 'ships'.");
            }
            return Workload.random(ships, seed);
        }

        List<String> keys = keys();
        if (!keys.contains(normalized)) {
            throw new InvalidValueException("Unknown workload '" + key + "'. Available: "
                    + String.join(", ", keys) + ", " + Workload.RANDOM_KEY + ".");
        }
        return Workload.fromFile(normalized);
    }
}
