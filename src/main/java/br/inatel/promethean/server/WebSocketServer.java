// https://javalin-io.translate.goog/documentation?_x_tr_sl=en&_x_tr_tl=pt&_x_tr_hl=pt&_x_tr_pto=tc&_x_tr_hist=true#getting-started

package br.inatel.promethean.server;

import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.ObjectMapper;

import br.inatel.promethean.simulation.SimulationEvent;
import br.inatel.promethean.simulation.SimulationListener;
import br.inatel.promethean.sync.SyncScenarioManager;
import io.javalin.Javalin;
import io.javalin.http.staticfiles.Location;
import io.javalin.websocket.WsContext;

import java.util.List;
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

        this.app.get("/api/scheduling/algorithms", ctx -> {
        ctx.json(List.of(
            Map.of("key", "fcfs", "name", "FCFS"),
            Map.of("key", "sjf", "name", "Shortest Job First"),
            Map.of("key", "priority", "name", "Priority with Aging")
        ));
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

        this.app.get("/api/scheduling", ctx -> {
            String algorithm = ctx.queryParam("algorithm");
            String fileName = switch (algorithm != null ? algorithm.toLowerCase() : "fcfs") {
                case "sjf" -> "/public/exemplos/escalonamento-sjf.json";
                case "priority" -> "/public/exemplos/escalonamento-priority.json";
                default -> "/public/exemplos/escalonamento-fcfs.json";
            };

            // Lê o JSON correspondente e devolve para o front
            try (var is = getClass().getResourceAsStream(fileName)) {
                if (is != null) {
                    ctx.contentType("application/json").result(is.readAllBytes());
                } else {
                    ctx.status(404);
                }
            }
    });
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
