package br.inatel.promethean.engine;

import br.inatel.promethean.model.ProcessState;
import br.inatel.promethean.model.SpaceCraft;
import br.inatel.promethean.model.Workload;
import br.inatel.promethean.scheduler.SchedulerCatalog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * O pedido do professor: comparar os algoritmos sempre com a mesma carga, e poder variar a carga.
 * Estes testes reproduzem os resultados de cada carga nos 4 algoritmos (valores conferidos no motor em 24/10)
 * e conferem que a gravação diz qual carga foi usada.
 */
class WorkloadComparisonTest {

    private static final List<String> ALGORITMOS = List.of("fcfs", "sjf", "sjf-preemptive", "priority");

    private static SimulationRecording gravar(String algoritmo, Workload carga) {
        return SimulationRecorder.recordSimulation(SchedulerCatalog.create(algoritmo), carga);
    }

    private static int esperaDe(SimulationRecording gravacao, String id) {
        return gravacao.spacecrafts().stream().filter(s -> s.getId().equals(id)).findFirst().orElseThrow().getWaitingTime();
    }

    private static int[] esperaNosQuatroAlgoritmos(String carga, String id) {
        return ALGORITMOS.stream().mapToInt(a -> esperaDe(gravar(a, Workload.fromFile(carga)), id)).toArray();
    }

    // ---------- a tabela: cada carga, cada algoritmo ----------

    @ParameterizedTest(name = "{0} com {1}: espera {2}, turnaround {3}, resposta {4}, trocas {5}")
    @CsvSource({
            // carga,   algoritmo,      espera, turnaround, resposta, trocas, vazão
            "referencia, fcfs,           8.75,  15.25,  8.75, 0, 0.1538",
            "referencia, sjf,            7.75,  14.25,  7.75, 0, 0.1538",
            "referencia, sjf-preemptive, 6.50,  13.00,  4.25, 1, 0.1538",
            "referencia, priority,       6.50,  13.00,  4.25, 1, 0.1538",
            "starwars,   fcfs,          10.40,  14.40, 10.40, 0, 0.2500",
            "starwars,   sjf,            9.40,  13.40,  9.40, 0, 0.2500",
            "starwars,   sjf-preemptive, 3.00,   7.00,  1.40, 1, 0.2500",
            "starwars,   priority,       5.00,   9.00,  3.40, 3, 0.2500",
            "halo,       fcfs,           5.33,   8.50,  5.33, 0, 0.3158",
            "halo,       sjf,            4.33,   7.50,  4.33, 0, 0.3158",
            "halo,       sjf-preemptive, 4.33,   7.50,  4.33, 0, 0.3158",
            "halo,       priority,       4.67,   7.83,  4.67, 0, 0.3158",
            "real,       fcfs,           0.40,   3.80,  0.40, 0, 0.2273",
            "real,       sjf,            0.40,   3.80,  0.40, 0, 0.2273",
            "real,       sjf-preemptive, 0.40,   3.80,  0.40, 0, 0.2273",
            "real,       priority,       1.20,   4.60,  0.20, 1, 0.2273",
            "alien,      fcfs,           7.60,  11.80,  7.60, 0, 0.2381",
            "alien,      sjf,            6.60,  10.80,  6.60, 0, 0.2381",
            "alien,      sjf-preemptive, 3.40,   7.60,  1.20, 1, 0.2381",
            "alien,      priority,       4.20,   8.40,  1.00, 4, 0.2381",
            "destiny,    fcfs,           7.50,  11.50,  7.50, 0, 0.2500",
            "destiny,    sjf,            7.50,  11.50,  7.50, 0, 0.2500",
            "destiny,    sjf-preemptive, 7.50,  11.50,  7.50, 0, 0.2500",
            "destiny,    priority,       9.33,  13.33,  2.00, 3, 0.2500",
    })
    void metricasDeCadaCargaSeReproduzem(String carga, String algoritmo, double espera, double turnaround,
                                         double resposta, int trocas, double vazao) {
        SimulationMetrics m = gravar(algoritmo, Workload.fromFile(carga)).metrics();

        assertEquals(espera, m.avgWaitingTime(), 0.005, "espera média");
        assertEquals(turnaround, m.avgTurnaroundTime(), 0.005, "turnaround médio");
        assertEquals(resposta, m.avgResponseTime(), 0.005, "resposta média");
        assertEquals(trocas, m.contextSwitches(), 0.0001, "trocas de contexto");
        assertEquals(vazao, m.throughput(), 0.00005, "vazão (naves por tick)");
    }

    // ---------- a mesma carga para todos os algoritmos ----------

    @Test
    void osQuatroAlgoritmosRecebemExatamenteAMesmaCarga() {
        Workload carga = Workload.fromFile("alien");
        List<String> primeira = null;

        for (String algoritmo : ALGORITMOS) {
            List<String> naves = gravar(algoritmo, carga).spacecrafts().stream()
                    .map(s -> s.getId() + "|" + s.getName() + "|" + s.getArrivalTime() + "|" + s.getBurstTime() + "|" + s.getBasePriority())
                    .toList();
            if (primeira == null) primeira = naves;
            assertEquals(primeira, naves, "a carga entregue ao " + algoritmo + " é diferente da entregue ao fcfs");
        }
    }

    @Test
    void simularNaoAlteraAsNavesMoldeDaCarga() {
        Workload carga = Workload.fromFile("starwars");

        for (String algoritmo : ALGORITMOS) {
            gravar(algoritmo, carga);
        }

        for (SpaceCraft molde : carga.getSpacecrafts()) {
            assertEquals(ProcessState.NEW, molde.getState(), molde.getId() + " foi simulada: a gravação precisa usar freshCopy()");
            assertEquals(molde.getBurstTime(), molde.getRemainingTime(), molde.getId() + " perdeu burst: a gravação precisa usar freshCopy()");
        }
    }

    // ---------- a gravação diz qual carga foi usada ----------

    @Test
    void gravacaoIdentificaACargaTematica() {
        SimulationRecording gravacao = gravar("fcfs", Workload.fromFile("starwars"));

        assertEquals("starwars", gravacao.workload().key());
        assertEquals("Bloqueio imperial", gravacao.workload().title());
        assertEquals("starwars", gravacao.workload().universe());
        assertNull(gravacao.workload().seed());
        assertEquals("Millennium Falcon", gravacao.spacecrafts().get(1).getName(), "a gravação leva o nome real para a tela");
    }

    @Test
    void gravacaoDaCargaAleatoriaGuardaASemente() {
        SimulationRecording gravacao = gravar("sjf", Workload.random(5, 42));

        assertEquals("aleatoria", gravacao.workload().key());
        assertEquals(42L, gravacao.workload().seed());
        assertNull(gravacao.workload().universe());
        assertEquals(List.of("R1", "R2", "R3", "R4", "R5"), gravacao.spacecrafts().stream().map(SpaceCraft::getId).toList());
    }

    @Test
    void gravacaoSemCargaContinuaUsandoAReferencia() {
        SimulationRecording gravacao = SimulationRecorder.recordSimulation(SchedulerCatalog.create("fcfs"));

        assertEquals("referencia", gravacao.workload().key());
        assertEquals(8.75, gravacao.metrics().avgWaitingTime(), 0.005);
    }

    // ---------- a lição de cada carga temática (espera de uma nave: FCFS, SJF, SJF preemptivo, Prioridade) ----------

    /** Comboio: o Star Destroyer atraca primeiro; só os algoritmos preemptivos tiram a Falcon da fila. */
    @Test
    void starWarsSoAPreempcaoTiraAFalconDoComboio() {
        assertArrayEquals(new int[]{11, 16, 0, 0}, esperaNosQuatroAlgoritmos("starwars", "FALCON"));
    }

    /** Starvation: no SJF a Phaeton, a mais longa, fica para o fim; na Prioridade, o aging a adianta. */
    @Test
    void haloOSjfDeixaAPhaetonParaOFimEOAgingAAdianta() {
        assertArrayEquals(new int[]{4, 13, 13, 10}, esperaNosQuatroAlgoritmos("halo", "PHAETON"));
    }

    /** Chegadas espaçadas: quase não há fila, e três algoritmos dão exatamente o mesmo resultado. */
    @Test
    void issComChegadasEspacadasAPoliticaQuaseNaoImporta() {
        SimulationMetrics fcfs = gravar("fcfs", Workload.fromFile("real")).metrics();

        for (String algoritmo : List.of("sjf", "sjf-preemptive")) {
            SimulationMetrics outro = gravar(algoritmo, Workload.fromFile("real")).metrics();
            assertEquals(fcfs.avgWaitingTime(), outro.avgWaitingTime(), 1e-9, algoritmo);
            assertEquals(fcfs.avgTurnaroundTime(), outro.avgTurnaroundTime(), 1e-9, algoritmo);
        }
    }

    /** Preempção em cascata: a Nostromo, a mais urgente, deixa de esperar, à custa de trocas de contexto. */
    @Test
    void alienAPreempcaoProtegeANostromo() {
        assertArrayEquals(new int[]{10, 6, 2, 0}, esperaNosQuatroAlgoritmos("alien", "NOSTROMO"));
    }

    /** Bursts iguais: o SJF não tem o que escolher e repete o FCFS; a Prioridade atende o Guardião primeiro. */
    @Test
    void destinyComBurstsIguaisOSjfRepeteOFcfs() {
        assertArrayEquals(new int[]{9, 9, 9, 0}, esperaNosQuatroAlgoritmos("destiny", "JUMP"));

        SimulationMetrics fcfs = gravar("fcfs", Workload.fromFile("destiny")).metrics();
        SimulationMetrics sjf = gravar("sjf", Workload.fromFile("destiny")).metrics();
        assertEquals(fcfs.avgWaitingTime(), sjf.avgWaitingTime(), 1e-9);
        assertEquals(fcfs.avgTurnaroundTime(), sjf.avgTurnaroundTime(), 1e-9);
    }
}
