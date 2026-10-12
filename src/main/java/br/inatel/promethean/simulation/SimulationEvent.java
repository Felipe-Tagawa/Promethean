package br.inatel.promethean.simulation;

public record SimulationEvent(int tick, EventType type, String spaceCraftId, String portId) {
}
