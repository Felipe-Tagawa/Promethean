// https://javalin-io.translate.goog/documentation?_x_tr_sl=en&_x_tr_tl=pt&_x_tr_hl=pt&_x_tr_pto=tc&_x_tr_hist=true#getting-started

package br.inatel.promethean.server;

import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.ObjectMapper;

import br.inatel.promethean.engine.SimulationEvent;
import br.inatel.promethean.engine.SimulationListener;
import br.inatel.promethean.engine.SimulationRecorder;
import br.inatel.promethean.exception.InvalidValueException;
import br.inatel.promethean.model.Workload;
import br.inatel.promethean.model.WorkloadCatalog;
import br.inatel.promethean.scheduler.Scheduler;
import br.inatel.promethean.scheduler.SchedulerCatalog;
import br.inatel.promethean.sync.SyncScenarioManager;
import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;
import io.javalin.websocket.WsContext;

import java.util.Set;
import java.util.Map;

public class WebSocketServer implements SimulationListener {

    private Javalin app;
    private SyncScenarioManager scenarioManager;

    private Set<WsContext> sessions = ConcurrentHashMap.newKeySet();
    private ObjectMapper mapper = new ObjectMapper();

    public void start(int port) {
        this.scenarioManager = new SyncScenarioManager(this);

        this.app = Javalin.create(config -> {
            config.staticFiles.add("/public", Location.CLASSPATH);
        }).start(port);

        this.app.ws("/ws/sync", ws -> {
            ws.onConnect(ctx -> {
                sessions.add(ctx);
                System.out.println("Navegador conectado ao canal de sincronismo!");
            });
            ws.onClose(ctx -> {
                sessions.remove(ctx);
                System.out.println("Navegador desconectado");
            });
            ws.onError(ctx -> {
                sessions.remove(ctx);
            });
        });

        // Lista de algoritmos para o seletor da tela; vem do mesmo catálogo que cria os escalonadores
        this.app.get("/api/scheduling/algorithms", ctx -> {
            ctx.json(SchedulerCatalog.list());
        });

        this.app.post("/api/sync/start", ctx -> {
            String scenario = ctx.queryParam("scenario");
            boolean sync = Boolean.parseBoolean(ctx.queryParam("sync"));
            String recovery = ctx.queryParam("recovery") != null ? ctx.queryParam("recovery") : "none";
            int ships = ctx.queryParamAsClass("ships",Integer.class).getOrDefault(3); 
            int arms = ctx.queryParamAsClass("arms", Integer.class).getOrDefault(1);

            this.scenarioManager.start(scenario, sync, recovery, ships, arms);

            ctx.status(200);
        });

        this.app.post("/api/sync/stop", ctx -> {
            this.scenarioManager.stop();
            ctx.status(200);
        });

        // Lista das cargas de arquivo para o seletor da tela; vem do mesmo índice que a tela lê sem servidor
        this.app.get("/api/scheduling/workloads", ctx -> {
            ctx.json(WorkloadCatalog.list());
        });

        // Roda o motor com o algoritmo e a carga pedidos e devolve a gravação completa (seção 3.2 do contrato da tela).
        // Sem "algorithm" roda o FCFS; sem "workload", a carga de referência; "workload=aleatoria" exige "seed" e "ships".
        // Qualquer parâmetro inválido responde 400.
        this.app.get("/api/scheduling", ctx -> {
            Scheduler scheduler;
            Workload workload;
            try {
                scheduler = SchedulerCatalog.create(ctx.queryParam("algorithm"));
                Long seed = parseNumber(ctx.queryParam("seed"), "seed");
                Long ships = parseNumber(ctx.queryParam("ships"), "ships");
                workload = WorkloadCatalog.create(ctx.queryParam("workload"), seed, ships == null ? null : Math.toIntExact(ships));
            } catch (InvalidValueException | ArithmeticException e) {
                // Chave desconhecida ou número inválido: o erro é de quem pediu, não do servidor
                ctx.status(400).json(Map.of("error", e.getMessage()));
                return;
            }

            ctx.json(SimulationRecorder.recordSimulation(scheduler, workload));
        });
    }

    /**
     * Lê um parâmetro numérico da URL
     *
     * @return o número, ou null se o parâmetro não veio
     * @throws InvalidValueException se o parâmetro veio e não é um número inteiro
     */
    private static Long parseNumber(String value, String name) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            throw new InvalidValueException("Parameter '" + name + "' must be a whole number, got '" + value + "'.");
        }
    }

    @Override
    public void onEvent(SimulationEvent event) {

    }

    public void broadcast(Object event) {
        try {
            String json = mapper.writeValueAsString(event);
            for (WsContext session : sessions) {
                session.send(json);
            }
        }catch (Exception e) {
            System.err.println("Erro ao enviar evento: " + e.getMessage());
        }
    }
}
