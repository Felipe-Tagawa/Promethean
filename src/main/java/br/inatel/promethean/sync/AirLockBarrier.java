package br.inatel.promethean.sync;

import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CyclicBarrier;

public class AirLockBarrier {

    private CyclicBarrier barrier;

    public AirLockBarrier () {
        this(2);
    }

    public AirLockBarrier(int parties) {
        this.barrier = new CyclicBarrier(parties);
    }

    public void awaitEqualization() throws InterruptedException, BrokenBarrierException {
        barrier.await();
    }

}
