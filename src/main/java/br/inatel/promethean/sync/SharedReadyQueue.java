package br.inatel.promethean.sync;

import br.inatel.promethean.model.SpaceCraft;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public class SharedReadyQueue {

    private Deque<SpaceCraft> queue;
    private ReentrantLock lock;
    private Condition notEmpty;

    public SharedReadyQueue () {
        this.queue = new ArrayDeque<>();
        this.lock = new ReentrantLock();
        this.notEmpty = this.lock.newCondition();
    }

    // Produtor

    public void enqueue(SpaceCraft s) {
        if (s == null) {
            throw new br.inatel.promethean.exception.InvalidValueException("Cannot enqueue a null spacecraft.");
        }
        lock.lock();
        try {
            queue.addLast(s);
            notEmpty.signal();
        }finally {
            lock.unlock();
        }
    }

    // Consumidor

    public SpaceCraft dequeue() throws InterruptedException{
        lock.lock();
        try{
            while(queue.isEmpty()) {
                notEmpty.await();
            }
            return queue.pollFirst();
        }finally{
            lock.unlock();
        }
    }

}
