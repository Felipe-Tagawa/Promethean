package br.inatel.promethean.model;

import br.inatel.promethean.exception.InvalidValueException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regra: a nave pode ter um nome real (ex.: "Millennium Falcon"); sem nome, continua só com o id.
 * O id curto é o que aparece nos eventos e no Gantt; o nome é só para exibição.
 */
class SpaceCraftNameTest {

    @Test
    void construtorComNomeGuardaONomeEOsDemaisCampos() {
        SpaceCraft falcon = new SpaceCraft("FALCON", "Millennium Falcon", 1, 3, 1);

        assertEquals("FALCON", falcon.getId());
        assertEquals("Millennium Falcon", falcon.getName());
        assertEquals(1, falcon.getArrivalTime());
        assertEquals(3, falcon.getBurstTime());
        assertEquals(1, falcon.getBasePriority());
    }

    @Test
    void construtorDeQuatroParametrosContinuaFuncionandoSemNome() {
        SpaceCraft n1 = new SpaceCraft("N1", 0, 8, 3);

        assertNull(n1.getName(), "sem nome, getName() devolve null e a tela mostra o id");
        assertEquals(8, n1.getRemainingTime());
    }

    @Test
    void construtorComNomeMantemAsValidacoesDoConstrutorAntigo() {
        assertThrows(InvalidValueException.class, () -> new SpaceCraft("X", "Nave", 0, 0, 1),
                "burst 0 continua inválido também no construtor novo");
        assertThrows(InvalidValueException.class, () -> new SpaceCraft(" ", "Nave", 0, 3, 1),
                "id vazio continua inválido também no construtor novo");
    }
}
