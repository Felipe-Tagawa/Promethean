package br.inatel.promethean.exception;

public class InvalidProcessStateException extends RuntimeException {
    public InvalidProcessStateException(String message) {
        super(message);
    }
}

