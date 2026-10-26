package br.inatel.promethean.model;

import br.inatel.promethean.exception.InvalidValueException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regras da carga aleatória, Workload.random(n, seed):
 * - n de 3 a 8 naves, com ids R1..Rn e sem nome;
 * - para cada nave, nesta ordem: chegada de 0 a 2n, burst de 1 a 10, prioridade de 1 a 4 (java.util.Random);
 * - a mesma semente gera sempre a mesma carga, para o resultado poder ser reproduzido.
 */
class WorkloadRandomTest {

    /** Resume a carga em texto, para comparar duas cargas de uma vez. */
    private static List<String> resumo(Workload carga) {
        return carga.getSpacecrafts().stream()
                .map(s -> s.getId() + "(" + s.getArrivalTime() + "," + s.getBurstTime() + "," + s.getBasePriority() + ")")
                .toList();
    }

    @Test
    void mesmaSementeGeraAMesmaCarga() {
        assertEquals(resumo(Workload.random(6, 123)), resumo(Workload.random(6, 123)));
    }

    @Test
    void sementesDiferentesGeramCargasDiferentes() {
        assertNotEquals(resumo(Workload.random(5, 42)), resumo(Workload.random(5, 7)));
    }

    /**
     * Protege a ordem do sorteio: para cada nave, chegada, depois burst, depois prioridade.
     * Se essa ordem mudar, uma semente já usada num relatório deixa de reproduzir a mesma carga.
     */
    @Test
    void sementeQuarentaEDoisComCincoNavesReproduzExatamenteEstaCarga() {
        assertEquals(List.of("R1(7,4,3)", "R2(5,1,4)", "R3(1,9,3)", "R4(6,3,2)", "R5(2,3,2)"),
                resumo(Workload.random(5, 42)));
    }

    @ParameterizedTest(name = "n = {0}")
    @ValueSource(ints = {3, 5, 8})
    void geraNNavesComIdsR1aRnESemNome(int n) {
        List<SpaceCraft> naves = Workload.random(n, 99).getSpacecrafts();

        assertEquals(n, naves.size());
        for (int i = 0; i < n; i++) {
            assertEquals("R" + (i + 1), naves.get(i).getId());
            assertNull(naves.get(i).getName());
        }
    }

    @Test
    void valoresSorteadosFicamDentroDasFaixas() {
        for (int n = 3; n <= 8; n++) {
            for (long semente = 0; semente < 200; semente++) {
                for (SpaceCraft s : Workload.random(n, semente).getSpacecrafts()) {
                    String onde = "n=" + n + ", semente=" + semente + ", " + s.getId();
                    assertTrue(s.getArrivalTime() >= 0 && s.getArrivalTime() <= 2 * n, "chegada fora de 0.." + 2 * n + ": " + onde);
                    assertTrue(s.getBurstTime() >= 1 && s.getBurstTime() <= 10, "burst fora de 1..10: " + onde);
                    assertTrue(s.getBasePriority() >= 1 && s.getBasePriority() <= 4, "prioridade fora de 1..4: " + onde);
                }
            }
        }
    }

    /** Pega o erro de um a menos: as faixas incluem os extremos (2n, 10 e 4 entram; 0 e 1 também). */
    @Test
    void osExtremosDasFaixasAparecem() {
        int n = 4;
        int menorChegada = Integer.MAX_VALUE, maiorChegada = Integer.MIN_VALUE;
        int menorBurst = Integer.MAX_VALUE, maiorBurst = Integer.MIN_VALUE;
        int menorPrioridade = Integer.MAX_VALUE, maiorPrioridade = Integer.MIN_VALUE;
        for (long semente = 0; semente < 300; semente++) {
            for (SpaceCraft s : Workload.random(n, semente).getSpacecrafts()) {
                menorChegada = Math.min(menorChegada, s.getArrivalTime());
                maiorChegada = Math.max(maiorChegada, s.getArrivalTime());
                menorBurst = Math.min(menorBurst, s.getBurstTime());
                maiorBurst = Math.max(maiorBurst, s.getBurstTime());
                menorPrioridade = Math.min(menorPrioridade, s.getBasePriority());
                maiorPrioridade = Math.max(maiorPrioridade, s.getBasePriority());
            }
        }
        assertEquals(0, menorChegada);
        assertEquals(2 * n, maiorChegada, "a chegada vai até 2n, inclusive");
        assertEquals(1, menorBurst);
        assertEquals(10, maiorBurst, "o burst vai até 10, inclusive");
        assertEquals(1, menorPrioridade);
        assertEquals(4, maiorPrioridade, "a prioridade vai até 4, inclusive");
    }

    @ParameterizedTest(name = "n = {0}")
    @ValueSource(ints = {0, 2, 9})
    void nForaDeTresAOitoFalha(int n) {
        assertThrows(InvalidValueException.class, () -> Workload.random(n, 42));
    }

    @Test
    void cargaAleatoriaGuardaASementeEFicaSemUniverso() {
        Workload carga = Workload.random(5, 42);

        assertEquals("aleatoria", carga.getKey());
        assertEquals(42L, carga.getSeed());
        assertNull(carga.getUniverse(), "a aleatória não pertence a um universo: na tela o seletor fica livre");
        assertTrue(carga.getTitle().contains("42"), "o título mostra a semente: " + carga.getTitle());
    }
}
