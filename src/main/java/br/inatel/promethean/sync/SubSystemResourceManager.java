// Implementação de Semáforos

package br.inatel.promethean.sync;

import java.util.concurrent.Semaphore;

public class SubSystemResourceManager {

    private Semaphore roboticArm;
    private Semaphore telemetryLinks;

    public SubSystemResourceManager() {
        this.roboticArm = new Semaphore(1, true); // true garante ordem de chegada
        this.telemetryLinks = new Semaphore(2, true);
    }

    public void acquire(ResourceType r) throws InterruptedException { // Pode ser interrompido caso a nave seja cancelada enquanto aguarda sua vez na fila.
        if(r == ResourceType.ROBOTIC_ARM) {
            roboticArm.acquire();
        }
        else if (r == ResourceType.TELEMETRY_LINK) {
            telemetryLinks.acquire();
        }
    }

    public void release(ResourceType r) {
        if (r == ResourceType.ROBOTIC_ARM) {
            roboticArm.release();
        }
        else if (r == ResourceType.TELEMETRY_LINK) {
            telemetryLinks.release();
        }
    }

}
