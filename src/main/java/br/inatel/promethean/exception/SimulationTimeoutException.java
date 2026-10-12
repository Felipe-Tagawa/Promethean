package br.inatel.promethean.exception;

public class SimulationTimeoutException extends RuntimeException {
    public SimulationTimeoutException(String message) {
        super(message);
    }
}

