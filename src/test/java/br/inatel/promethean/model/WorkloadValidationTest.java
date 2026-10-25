package br.inatel.promethean.model;

import br.inatel.promethean.exception.InvalidValueException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regras que o construtor de Workload confere, para qualquer origem da carga (arquivo, sorteio ou código):
 * de 1 a 8 naves, ids únicos de até 8 caracteres e no máximo 4 níveis de prioridade.
 * Toda violação vira InvalidValueException.
 */
class WorkloadValidationTest {

    private static SpaceCraft nave(String id, int prioridade) {
        return new SpaceCraft(id, 0, 1, prioridade);
    }

    private static Workload carga(List<SpaceCraft> naves) {
        return new Workload("teste", "Carga de teste", "padrao", "Usada só nos testes.", naves);
    }

    private static List<SpaceCraft> naves(int quantidade) {
        List<SpaceCraft> lista = new ArrayList<>();
        for (int i = 1; i <= quantidade; i++) {
            lista.add(nave("N" + i, 1 + (i - 1) % 4));
        }
        return lista;
    }

    // ---------- quantidade de naves: de 1 a 8 ----------

    @Test
    void umaNaveEhOMinimoValido() {
        assertEquals(1, carga(naves(1)).getSpacecrafts().size());
    }

    @Test
    void oitoNavesEhOMaximoValido() {
        assertEquals(8, carga(naves(8)).getSpacecrafts().size());
    }

    @Test
    void cargaSemNavesFalha() {
        assertThrows(InvalidValueException.class, () -> carga(List.of()));
    }

    @Test
    void listaNulaContaComoZeroNavesEFalha() {
        assertThrows(InvalidValueException.class, () -> carga(null),
                "lista nula deve dar InvalidValueException, e não NullPointerException");
    }

    @Test
    void noveNavesFalha() {
        assertThrows(InvalidValueException.class, () -> carga(naves(9)));
    }

    // ---------- ids: únicos e com até 8 caracteres ----------

    @Test
    void idRepetidoFalhaENomeiaOIdNaMensagem() {
        InvalidValueException erro = assertThrows(InvalidValueException.class,
                () -> carga(List.of(nave("RED5", 1), nave("FALCON", 2), nave("RED5", 3))));

        assertTrue(erro.getMessage().contains("RED5"), "a mensagem precisa dizer qual id se repetiu: " + erro.getMessage());
    }

    @Test
    void idComOitoCaracteresEhValido() {
        assertEquals("PROGRESS", carga(List.of(nave("PROGRESS", 1))).getSpacecrafts().get(0).getId());
    }

    @Test
    void idComNoveCaracteresFalhaENomeiaOIdNaMensagem() {
        InvalidValueException erro = assertThrows(InvalidValueException.class,
                () -> carga(List.of(nave("PROGRESS2", 1))));

        assertTrue(erro.getMessage().contains("PROGRESS2"), "a mensagem precisa dizer qual id é longo demais: " + erro.getMessage());
    }

    // ---------- prioridade: no máximo 4 níveis diferentes ----------

    @Test
    void quatroNiveisDePrioridadeSaoValidos() {
        assertDoesNotThrow(() -> carga(List.of(nave("A", 1), nave("B", 2), nave("C", 3), nave("D", 4))));
    }

    @Test
    void cincoNiveisDePrioridadeFalham() {
        assertThrows(InvalidValueException.class,
                () -> carga(List.of(nave("A", 1), nave("B", 2), nave("C", 3), nave("D", 4), nave("E", 5))));
    }

    @Test
    void prioridadesRepetidasNaoContamComoNiveisNovos() {
        // 8 naves, mas só 4 valores diferentes de prioridade: o que conta são os níveis, não as naves
        assertDoesNotThrow(() -> carga(naves(8)));
    }

    @Test
    void niveisNaoPrecisamSerConsecutivos() {
        // 1, 5, 9 e 20 são 4 níveis: a regra limita a quantidade de níveis, não os valores
        assertDoesNotThrow(() -> carga(List.of(nave("A", 1), nave("B", 5), nave("C", 9), nave("D", 20))));
    }

    // ---------- a carga guarda os dados e não pode ser alterada por fora ----------

    @Test
    void gettersDevolvemOsDadosDoConstrutor() {
        Workload carga = carga(naves(2));

        assertEquals("teste", carga.getKey());
        assertEquals("Carga de teste", carga.getTitle());
        assertEquals("padrao", carga.getUniverse());
        assertEquals("Usada só nos testes.", carga.getDescription());
        assertNull(carga.getSeed(), "só a carga aleatória tem semente");
    }

    @Test
    void listaDeNavesDaCargaEhImutavel() {
        Workload carga = carga(naves(2));

        assertThrows(UnsupportedOperationException.class, () -> carga.getSpacecrafts().add(nave("X", 1)));
    }

    @Test
    void alterarAListaOriginalDepoisNaoMudaACarga() {
        List<SpaceCraft> original = naves(2);
        Workload carga = carga(original);

        original.add(nave("INTRUSA", 1));

        assertEquals(2, carga.getSpacecrafts().size(), "a carga precisa guardar uma cópia da lista recebida");
    }
}
