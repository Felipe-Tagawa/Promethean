package br.inatel.promethean.server;

import br.inatel.promethean.simulation.SimulationEvent;
import br.inatel.promethean.simulation.SimulationListener;
import io.javalin.Javalin;

public class WebSocketServer implements SimulationListener {

    public void start(int port) {
        Javalin app = Javalin.create().start(port);
    }

    @Override
    public void onEvent(SimulationEvent event) {

    }
}
