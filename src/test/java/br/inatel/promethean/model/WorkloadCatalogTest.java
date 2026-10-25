package br.inatel.promethean.model;

import br.inatel.promethean.exception.InvalidValueException;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regra: o arquivo public/workloads/index.json lista as chaves das cargas, na ordem do seletor.
 * O Java (WorkloadCatalog) e a tela leem o mesmo índice, então ele e os arquivos precisam combinar.
 */
class WorkloadCatalogTest {

    private static final List<String> TEMATICAS = List.of("starwars", "halo", "real", "alien", "destiny");

    @Test
    void keysDevolveAsChavesNaOrdemDoIndice() {
        assertEquals(List.of("referencia", "starwars", "halo", "real", "alien", "destiny"), WorkloadCatalog.keys());
    }

    @Test
    void cadaChaveDoIndiceTemUmArquivoComAMesmaChave() {
        for (String chave : WorkloadCatalog.keys()) {
            assertEquals(chave, Workload.fromFile(chave).getKey(), "o campo key de " + chave + ".json precisa ser \"" + chave + "\"");
        }
    }

    @Test
    void cadaCargaTematicaPertenceAoUniversoDeMesmoNome() {
        assertEquals("padrao", Workload.fromFile("referencia").getUniverse());
        for (String chave : TEMATICAS) {
            assertEquals(chave, Workload.fromFile(chave).getUniverse(), "universo de " + chave);
        }
    }

    @Test
    void naveDeCargaTematicaSempreTemNome() {
        for (String chave : TEMATICAS) {
            for (SpaceCraft s : Workload.fromFile(chave).getSpacecrafts()) {
                assertNotNull(s.getName(), s.getId() + " em " + chave + " está sem nome");
                assertFalse(s.getName().isBlank(), s.getId() + " em " + chave + " está com nome vazio");
            }
        }
    }

    /**
     * Na tela, o desenho e a situação da nave saem do nível de prioridade dela (0 a 3).
     * Com os 4 níveis presentes, cada nave usa o desenho que combina com o nome e as ameaças acham seus alvos.
     */
    @Test
    void cargaTematicaUsaOsQuatroNiveisDePrioridade() {
        for (String chave : TEMATICAS) {
            Set<Integer> niveis = new HashSet<>();
            Workload.fromFile(chave).getSpacecrafts().forEach(s -> niveis.add(s.getBasePriority()));
            assertEquals(Set.of(1, 2, 3, 4), niveis, "níveis de prioridade de " + chave);
        }
    }

    // ---------- create: o que o servidor usa para montar a carga pedida na URL ----------

    @Test
    void createSemChaveUsaAReferencia() {
        assertEquals("referencia", WorkloadCatalog.create(null, null, null).getKey());
        assertEquals("referencia", WorkloadCatalog.create("  ", null, null).getKey());
    }

    @Test
    void createAceitaChaveComMaiusculasEEspacos() {
        assertEquals("starwars", WorkloadCatalog.create(" StarWars ", null, null).getKey());
    }

    @Test
    void createAleatoriaUsaASementeEONumeroDeNaves() {
        Workload carga = WorkloadCatalog.create("aleatoria", 42L, 5);

        assertEquals(42L, carga.getSeed());
        assertEquals(5, carga.getSpacecrafts().size());
    }

    @Test
    void createAleatoriaSemSementeOuSemNavesFalha() {
        assertThrows(InvalidValueException.class, () -> WorkloadCatalog.create("aleatoria", null, 5));
        assertThrows(InvalidValueException.class, () -> WorkloadCatalog.create("aleatoria", 42L, null));
    }

    /** Só chaves do índice: um pedido na URL não pode ler outro arquivo do classpath. */
    @Test
    void createRecusaChaveForaDoIndice() {
        assertThrows(InvalidValueException.class, () -> WorkloadCatalog.create("naoexiste", null, null));
        assertThrows(InvalidValueException.class, () -> WorkloadCatalog.create("../workloads/starwars", null, null));
        assertThrows(InvalidValueException.class, () -> WorkloadCatalog.create("index", null, null));
    }

    @Test
    void listResumeCadaCargaNaOrdemDoIndice() {
        List<WorkloadCatalog.Entry> lista = WorkloadCatalog.list();

        assertEquals(WorkloadCatalog.keys(), lista.stream().map(WorkloadCatalog.Entry::key).toList());
        WorkloadCatalog.Entry starWars = lista.get(1);
        assertEquals("Bloqueio imperial", starWars.title());
        assertEquals("starwars", starWars.universe());
        assertFalse(starWars.description().isBlank());
        assertEquals(5, starWars.ships(), "ships é o número de naves da carga");
    }
}
