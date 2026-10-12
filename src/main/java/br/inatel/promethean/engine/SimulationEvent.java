package br.inatel.promethean.engine;

public record SimulationEvent(int tick, EventType type, String spaceCraftId, String portId) {
}
