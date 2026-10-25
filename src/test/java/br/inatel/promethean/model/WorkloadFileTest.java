package br.inatel.promethean.model;

import br.inatel.promethean.exception.InvalidValueException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regra: as cargas ficam em src/main/resources/public/workloads/<chave>.json e são lidas por Workload.fromFile(chave).
 * A carga de referência (N1 a N4) é um desses arquivos, e Workload.reference() a lê de lá.
 */
class WorkloadFileTest {

    @Test
    void fromFileLeOsDadosDaCarga() {
        Workload starWars = Workload.fromFile("starwars");

        assertEquals("starwars", starWars.getKey());
        assertEquals("Bloqueio imperial", starWars.getTitle());
        assertEquals("starwars", starWars.getUniverse());
        assertFalse(starWars.getDescription().isBlank());
        assertNull(starWars.getSeed(), "carga de arquivo não tem semente");
    }

    @Test
    void fromFileLeAsNavesNaOrdemDoArquivo() {
        List<String> ids = Workload.fromFile("starwars").getSpacecrafts().stream().map(SpaceCraft::getId).toList();

        assertEquals(List.of("DESTROY", "FALCON", "RED5", "TIE", "RED2"), ids);
    }

    @Test
    void fromFileLeTodosOsCamposDeUmaNave() {
        SpaceCraft destroyer = Workload.fromFile("starwars").getSpacecrafts().get(0);

        assertEquals("DESTROY", destroyer.getId());
        assertEquals("Star Destroyer", destroyer.getName());
        assertEquals(0, destroyer.getArrivalTime());
        assertEquals(12, destroyer.getBurstTime());
        assertEquals(3, destroyer.getBasePriority());
    }

    @Test
    void naveSemNomeNoArquivoFicaComNameNulo() {
        assertNull(Workload.fromFile("referencia").getSpacecrafts().get(0).getName());
    }

    @Test
    void referenceLeOArquivoDeReferencia() {
        Workload referencia = Workload.reference();

        assertEquals("referencia", referencia.getKey());
        assertEquals("padrao", referencia.getUniverse());
        List<SpaceCraft> naves = referencia.getSpacecrafts();
        assertEquals(4, naves.size());
        assertNave(naves.get(0), "N1", 0, 8, 3);
        assertNave(naves.get(1), "N2", 1, 4, 1);
        assertNave(naves.get(2), "N3", 2, 9, 4);
        assertNave(naves.get(3), "N4", 3, 5, 2);
    }

    @Test
    void chaveDesconhecidaFalhaENomeiaAChaveNaMensagem() {
        InvalidValueException erro = assertThrows(InvalidValueException.class, () -> Workload.fromFile("naoexiste"));

        assertTrue(erro.getMessage().contains("naoexiste"), "a mensagem precisa dizer qual carga não existe: " + erro.getMessage());
    }

    // ---------- freshCopy: cada algoritmo recebe naves novas, com os mesmos dados ----------

    @Test
    void freshCopyCopiaONomeTambem() {
        List<SpaceCraft> copia = Workload.fromFile("starwars").freshCopy();

        assertEquals("Millennium Falcon", copia.get(1).getName(), "sem copiar o nome, a tela perde o nome real");
    }

    @Test
    void freshCopyDevolveNavesNovasComOsMesmosDados() {
        Workload carga = Workload.fromFile("halo");
        List<SpaceCraft> copia = carga.freshCopy();

        for (int i = 0; i < copia.size(); i++) {
            SpaceCraft molde = carga.getSpacecrafts().get(i);
            SpaceCraft nova = copia.get(i);
            assertNotSame(molde, nova, "a cópia precisa ser um objeto novo");
            assertNave(nova, molde.getId(), molde.getArrivalTime(), molde.getBurstTime(), molde.getBasePriority());
            assertEquals(ProcessState.NEW, nova.getState());
        }
    }

    private static void assertNave(SpaceCraft nave, String id, int chegada, int burst, int prioridade) {
        assertEquals(id, nave.getId());
        assertEquals(chegada, nave.getArrivalTime(), "chegada de " + id);
        assertEquals(burst, nave.getBurstTime(), "burst de " + id);
        assertEquals(prioridade, nave.getBasePriority(), "prioridade de " + id);
    }
}
