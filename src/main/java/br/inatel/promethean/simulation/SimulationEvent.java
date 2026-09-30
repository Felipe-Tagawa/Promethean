package br.inatel.promethean.simulation;

import jdk.dynalink.beans.StaticClass;

public record SimulationEvent(int tick, EventType type, String spaceCraftId, String portId) {
}
