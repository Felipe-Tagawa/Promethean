package br.inatel.promethean.model;

import br.inatel.promethean.exception.InvalidValueException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * Carga de trabalho: o conjunto de naves (processos) que chega à estação.
 * A mesma carga é entregue a todos os escalonadores, para a comparação ser justa;
 * trocar de carga é o que permite ver resultados diferentes.
 *
 * As cargas fixas ficam em src/main/resources/public/workloads/<chave>.json (lidas por fromFile),
 * e random(n, seed) sorteia uma carga nova que se repete sempre que a semente for a mesma.
 */
public class Workload {

    // Limites que toda carga respeita, venha de arquivo, do sorteio ou de código
    public static final int MIN_SHIPS = 1;
    public static final int MAX_SHIPS = 8;            // a órbita da tela fica legível até umas 8 naves
    public static final int MAX_ID_LENGTH = 8;        // o id precisa caber nas barras do Gantt e sobre a nave
    public static final int MAX_PRIORITY_LEVELS = 4;  // cada universo da tela tem 4 situações de prioridade

    // Carga aleatória
    public static final String RANDOM_KEY = "aleatoria";
    public static final int RANDOM_MIN_SHIPS = 3;
    public static final int RANDOM_MAX_SHIPS = 8;
    private static final int RANDOM_MAX_BURST = 10;
    private static final int RANDOM_PRIORITY_LEVELS = 4;

    /** Pasta das cargas no classpath. Fica dentro de public/ para a tela também poder ler os arquivos. */
    static final String FOLDER = "/public/workloads/";

    /** O ObjectMapper é caro de criar e pode ser compartilhado. */
    static final ObjectMapper JSON = new ObjectMapper();

    private final String key;
    private final String title;
    private final String universe;
    private final String description;
    private final Long seed;                      // só na carga aleatória; null nas de arquivo
    private final List<SpaceCraft> spacecrafts;   // naves "molde": nunca são simuladas, só copiadas

    /** Formato de uma nave no arquivo: os mesmos nomes de campo da gravação que a tela recebe. */
    record ShipFile(String id, String name, int arrivalTime, int burstTime, int basePriority) {}

    /** Formato do arquivo de uma carga. */
    record WorkloadFile(String key, String title, String universe, String description, List<ShipFile> spacecrafts) {}

    /**
     * Cria uma carga e confere as regras: de 1 a 8 naves, ids únicos de até 8 caracteres
     * e no máximo 4 níveis de prioridade diferentes
     *
     * @param key chave da carga (a mesma do nome do arquivo)
     * @param title nome curto, mostrado no seletor
     * @param universe universo da tela a que a carga pertence; null se ela não pertence a nenhum
     * @param description o que a carga mostra
     * @param spacecrafts naves que formam a carga
     * @throws InvalidValueException se alguma regra for quebrada
     */
    public Workload(String key, String title, String universe, String description, List<SpaceCraft> spacecrafts) {
        this(key, title, universe, description, null, spacecrafts);
    }

    private Workload(String key, String title, String universe, String description, Long seed, List<SpaceCraft> spacecrafts) {
        validate(spacecrafts); // antes de copiar: List.copyOf(null) lançaria NullPointerException
        this.key = key;
        this.title = title;
        this.universe = universe;
        this.description = description;
        this.seed = seed;
        this.spacecrafts = List.copyOf(spacecrafts); // cópia imutável: mudar a lista recebida depois não muda a carga
    }

    private static void validate(List<SpaceCraft> spacecrafts) {
        int count = (spacecrafts == null) ? 0 : spacecrafts.size();
        if (count < MIN_SHIPS || count > MAX_SHIPS) {
            throw new InvalidValueException("A workload needs " + MIN_SHIPS + " to " + MAX_SHIPS + " spacecrafts, got " + count + ".");
        }

        Set<String> ids = new HashSet<>();
        Set<Integer> levels = new HashSet<>();
        for (SpaceCraft s : spacecrafts) {
            if (s.getId().length() > MAX_ID_LENGTH) {
                throw new InvalidValueException("Spacecraft id '" + s.getId() + "' is longer than " + MAX_ID_LENGTH + " characters.");
            }
            if (!ids.add(s.getId())) { // add devolve false quando o id já estava no conjunto
                throw new InvalidValueException("Spacecraft id '" + s.getId() + "' appears more than once.");
            }
            levels.add(s.getBasePriority());
        }

        // Conta os níveis diferentes, não os valores: 1, 5, 9 e 20 são 4 níveis
        if (levels.size() > MAX_PRIORITY_LEVELS) {
            throw new InvalidValueException("A workload can have at most " + MAX_PRIORITY_LEVELS
                    + " priority levels, got " + levels.size() + ": " + levels + ".");
        }
    }

    /**
     * Carga de referência: exemplo clássico de SJF dos livros de SO (N1 a N4).
     * Os resultados esperados dela são calculados à mão e comparados com a saída do simulador
     *
     * @return a carga de referencia.json
     */
    public static Workload reference() {
        return fromFile("referencia");
    }

    /**
     * Lê uma carga de src/main/resources/public/workloads/<chave>.json.
     * O arquivo é lido pelo classpath, então funciona também de dentro do jar e do Docker
     *
     * @param key chave da carga, sem ".json" (ex.: "starwars")
     * @return a carga, já validada
     * @throws InvalidValueException se o arquivo não existir, for inválido ou quebrar alguma regra
     */
    public static Workload fromFile(String key) {
        try (InputStream in = Workload.class.getResourceAsStream(FOLDER + key + ".json")) {
            if (in == null) { // getResourceAsStream não lança erro: devolve null quando o arquivo não existe
                throw new InvalidValueException("Unknown workload '" + key + "'.");
            }
            WorkloadFile file = JSON.readValue(in, WorkloadFile.class);

            List<SpaceCraft> spacecrafts = null; // sem a lista no arquivo, a validação acusa zero naves
            if (file.spacecrafts() != null) {
                spacecrafts = new ArrayList<>();
                for (ShipFile s : file.spacecrafts()) {
                    spacecrafts.add(new SpaceCraft(s.id(), s.name(), s.arrivalTime(), s.burstTime(), s.basePriority()));
                }
            }
            return new Workload(file.key(), file.title(), file.universe(), file.description(), spacecrafts);
        } catch (IOException e) {
            throw new InvalidValueException("Workload file '" + key + ".json' is invalid: " + e.getMessage());
        }
    }

    /**
     * Sorteia uma carga com java.util.Random. A mesma semente gera sempre a mesma carga,
     * em qualquer máquina, então o resultado pode ser reproduzido.
     * Para cada nave, nesta ordem: chegada de 0 a 2n, burst de 1 a 10 e prioridade de 1 a 4.
     * Mudar essa ordem muda a carga de todas as sementes já usadas
     *
     * @param n número de naves, de 3 a 8
     * @param seed semente do sorteio
     * @return carga com as naves R1..Rn, sem nome e sem universo
     * @throws InvalidValueException se n estiver fora de 3 a 8
     */
    public static Workload random(int n, long seed) {
        if (n < RANDOM_MIN_SHIPS || n > RANDOM_MAX_SHIPS) {
            throw new InvalidValueException("A random workload needs " + RANDOM_MIN_SHIPS + " to " + RANDOM_MAX_SHIPS
                    + " spacecrafts, got " + n + ".");
        }
        Random random = new Random(seed);
        List<SpaceCraft> spacecrafts = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            int arrivalTime = random.nextInt(2 * n + 1);             // 0 a 2n, inclusive
            int burstTime = 1 + random.nextInt(RANDOM_MAX_BURST);       // 1 a 10
            int priority = 1 + random.nextInt(RANDOM_PRIORITY_LEVELS);  // 1 a 4
            spacecrafts.add(new SpaceCraft("R" + i, arrivalTime, burstTime, priority));
        }
        return new Workload(RANDOM_KEY, "Aleatória (semente " + seed + ")", null,
                n + " naves sorteadas com a semente " + seed + ".", seed, spacecrafts);
    }

    /**
     * Cria naves novas com os mesmos id, nome, arrivalTime, burstTime e basePriority da carga.
     * A simulação altera a nave (remainingTime, estado, tempos), então cada algoritmo
     * precisa receber a sua própria cópia zerada
     *
     * @return lista nova, com naves em NEW e contadores zerados
     */
    public List<SpaceCraft> freshCopy() {
        List<SpaceCraft> copy = new ArrayList<>();
        for (SpaceCraft s : spacecrafts) {
            copy.add(new SpaceCraft(s.getId(), s.getName(), s.getArrivalTime(), s.getBurstTime(), s.getBasePriority()));
        }
        return copy;
    }

    public String getKey() { return key; }

    public String getTitle() { return title; }

    /** Universo da tela a que a carga pertence; null na aleatória. */
    public String getUniverse() { return universe; }

    public String getDescription() { return description; }

    /** Semente da carga aleatória; null nas cargas de arquivo. */
    public Long getSeed() { return seed; }

    /** As naves molde, numa lista imutável. Para simular, use freshCopy(). */
    public List<SpaceCraft> getSpacecrafts() { return spacecrafts; }
}
