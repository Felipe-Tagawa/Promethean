package br.inatel.promethean.sync;

import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CyclicBarrier;

public class AirLockBarrier {

    private CyclicBarrier barrier;

    public AirLockBarrier () {
        this.barrier = new CyclicBarrier(2); // Barreira abre com 2 threads
    }

    public void awaitEqualization() throws InterruptedException, BrokenBarrierException {
        barrier.await();
    }

}
