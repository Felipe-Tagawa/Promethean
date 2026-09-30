package br.inatel.promethean.sync;

import br.inatel.promethean.model.SpaceCraft;

import java.util.Deque;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public class SharedReadyQueue {

    private Deque<SpaceCraft> queue;
    private ReentrantLock lock;
    private Condition notEmpty;

    public void enqueue(SpaceCraft s) {

    }

    public SpaceCraft dequeue() {
        return null;
    }

}
