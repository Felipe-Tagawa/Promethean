package br.inatel.promethean.simulation;

import jdk.dynalink.beans.StaticClass;

public record SimulationEvent() {

    static int tick;
    static EventType type;
    static String spaceCraftId;
    static String portId;
}
