package br.inatel.promethean.sync;

import br.inatel.promethean.server.WebSocketServer;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class SyncScenarioManager {

    private final WebSocketServer server; // para onde mandamos o broadcast
    private final AtomicInteger seq = new AtomicInteger(0); // contador de eventos thread-safe
    private long startTime;
    private volatile boolean running = false;
    private final List<Thread> activeThreads = new ArrayList<>();

    public SyncScenarioManager(WebSocketServer server) {
        this.server = server;
    }

    public synchronized void emit(Map<String, Object> event) {
        if(!running && !"SYNC_END".equals(event.get("type"))) {
            return;
        }
        Map<String, Object> copy = new HashMap<>(event);
        copy.put("seq", seq.getAndIncrement());
        copy.put("timeMs", System.currentTimeMillis() - startTime);
        server.broadcast(copy);
    }

    public synchronized void stop() {
        if (!running) return;
            running = false;
            
        // Interrompe todas as threads de naves que estiverem dormindo ou esperando recurso
        for (Thread t : activeThreads) {
            t.interrupt();
        }
        activeThreads.clear();
        // Avisa a tela que foi parado
        Map<String, Object> endEvent = new HashMap<>();
        endEvent.put("type", "SYNC_END");
        endEvent.put("reason", "STOPPED");
        emit(endEvent);
    }

    private void startRaceScenario(boolean sync, int ships, int arms, List<String> shipIds) {
    
        Map<String, Object> startEvent = new HashMap<>();
        startEvent.put("type", "SYNC_START");
        startEvent.put("scenario", "race");
        startEvent.put("sync", sync);
        startEvent.put("spacecrafts", shipIds);
        startEvent.put("resources", List.of(Map.of("id", "ROBOTIC_ARMS", "capacity", arms)));
        emit(startEvent);

        // Recursos compartilhados
        java.util.concurrent.Semaphore semaphore = new java.util.concurrent.Semaphore(arms, true);
        Set<String> currentlyUsing = ConcurrentHashMap.newKeySet();
        AtomicInteger collisions = new AtomicInteger(0);
        AtomicInteger actualCargo = new AtomicInteger(0);
        int expectedCargo = ships * 100;

        List<Thread> shipThreads = new ArrayList<>();

        // Dispara uma Thread real para cada nave
        int index = 0;
        for (String shipId : shipIds) {
            int arrivalDelay = index * 250;
            index++;
            Thread t = new Thread(() -> {
                try {
                    Thread.sleep(arrivalDelay); // pequeno intervalo de chegada

                    // A nave pede o braço
                    emit(Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", "ROBOTIC_ARMS"));

                    if (sync) {
                        semaphore.acquire(); // Bloqueio real via Semáforo!
                    }

                    // A nave pegou o braço
                    currentlyUsing.add(shipId);
                    emit(Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", "ROBOTIC_ARMS"));

                    // Se não tem sincronismo e ultrapassou a capacidade -- Colide.
                    if (!sync && currentlyUsing.size() > arms) {
                        collisions.incrementAndGet();
                        emit(Map.of(
                            "type", "COLLISION",
                            "resourceId", "ROBOTIC_ARMS",
                            "spaceCraftIds", new ArrayList<>(currentlyUsing)
                        ));
                    }

                    // Trabalha transferindo carga
                    Thread.sleep(800);
                    if (sync) {
                        actualCargo.addAndGet(100);
                    } else {
                        // Sem sincronismo, perde parte da carga na colisão
                        actualCargo.addAndGet(Math.max(20, 100 - (currentlyUsing.size() - arms) * 40));
                    }

                    // Libera o braço
                    currentlyUsing.remove(shipId);
                    emit(Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", "ROBOTIC_ARMS"));
                    if (sync) {
                        semaphore.release();
                    }

                    emit(Map.of("type", "DONE", "spaceCraftId", shipId));

                } catch (InterruptedException e) {
                    // Thread foi interrompida pelo stop()
                }
            });

            shipThreads.add(t);
            activeThreads.add(t);
            t.start();
        }

        // Thread em segundo plano que aguarda todas terminarem para mandar o SYNC_END
        Thread monitor = new Thread(() -> {
            try {
                for (Thread t : shipThreads) {
                    t.join();
                }
                if (running) {
                    Map<String, Object> endEvent = new HashMap<>();
                    endEvent.put("type", "SYNC_END");
                    endEvent.put("reason", "COMPLETED");
                    endEvent.put("collisions", collisions.get());
                    endEvent.put("cargoExpected", expectedCargo);
                    endEvent.put("cargoActual", actualCargo.get());
                    emit(endEvent);
                }
            } catch (InterruptedException ignored) {}
        });
        activeThreads.add(monitor);
        monitor.start();
    }

    // Cenário do Deadlock dentro de sincronismo
    private void startDeadlockScenario(String recovery, int ships, int arms, List<String> shipIds) {
        // Cria a lista de braços: ROBOTIC_ARM_A, ROBOTIC_ARM_B...
        List<String> armNames = new ArrayList<>();
        List<Map<String, Object>> resourceList = new ArrayList<>();
        Map<String, java.util.concurrent.locks.ReentrantLock> locks = new LinkedHashMap<>();

        for (int i = 0; i < arms; i++) {
            char letter = (char) ('A' + i);
            String armId = "ROBOTIC_ARM_" + letter;
            armNames.add(armId);
            resourceList.add(Map.of("id", armId, "capacity", 1));
            locks.put(armId, new java.util.concurrent.locks.ReentrantLock());
        }

        // Emite o início para o front desenhar os braços com letras
        Map<String, Object> startEvent = new HashMap<>();
        startEvent.put("type", "SYNC_START");
        startEvent.put("scenario", "deadlock");
        startEvent.put("sync", true);
        startEvent.put("recovery", recovery);
        startEvent.put("spacecrafts", shipIds);
        startEvent.put("resources", resourceList);
        emit(startEvent);

        int shipCount = shipIds.size();
        int armCount = armNames.size();
        int ringSize = Math.min(shipCount, armCount);
        boolean hasDeadlock = shipCount >= armCount && armCount >= 2;
        List<String> cycleShips = shipIds.subList(0, ringSize);

        // Barreira para que apenas as naves do anel peguem o primeiro braço juntas antes de pedir o segundo
        java.util.concurrent.CyclicBarrier barrier = new java.util.concurrent.CyclicBarrier(ringSize);

        List<Thread> shipThreads = new ArrayList<>();

        // Dispara cada nave em sua própria Thread
        for (int i = 0; i < shipCount; i++) {
            final int index = i;
            final String shipId = shipIds.get(i);
            final String firstArm = armNames.get(index % armCount);
            final String secondArm = armNames.get((index + 1) % armCount);

            Thread t = new Thread(() -> {
                try {
                    // Pede e adquire o primeiro braço
                    emit(Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", firstArm));
                    locks.get(firstArm).lock();
                    emit(Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", firstArm));

                    // Aguarda apenas as naves do anel pegarem o primeiro braço juntas
                    if (index < ringSize) {
                        barrier.await();
                        Thread.sleep(300);
                    }

                    // Pede o segundo braço (onde o impasse acontece para as naves do anel)
                    emit(Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", secondArm));

                    if ("timeout".equals(recovery)) {
                        // MODO TIMEOUT: tenta por tempo limitado (a maior nave do anel desiste primeiro)
                        long timeout = (index == ringSize - 1) ? 500 : 2500;
                        boolean acquired = locks.get(secondArm).tryLock(timeout, java.util.concurrent.TimeUnit.MILLISECONDS);

                        if (!acquired) {
                            // Desiste, solta o primeiro braço e recua
                            emit(Map.of("type", "TIMEOUT", "spaceCraftId", shipId, "resourceId", secondArm));
                            locks.get(firstArm).unlock();
                            emit(Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", firstArm));

                            // Espera o colega terminar e tenta de novo do zero
                            Thread.sleep(1200);
                            emit(Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", firstArm));
                            locks.get(firstArm).lock();
                            emit(Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", firstArm));

                            emit(Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", secondArm));
                            locks.get(secondArm).lock();
                            emit(Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", secondArm));
                        } else {
                            emit(Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", secondArm));
                        }
                    } else {
                        // MODO NORMAL OU DETECTION:
                        try {
                            locks.get(secondArm).lockInterruptibly();
                            emit(Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", secondArm));
                        } catch (InterruptedException e) {
                            // Abortada como vítima pelo monitor de deadlock!
                            // Solta o primeiro braço e recua
                            locks.get(firstArm).unlock();
                            emit(Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", firstArm));

                            // Espera o colega terminar e tenta de novo do zero (Rollback & Retry)
                            Thread.sleep(1200);
                            emit(Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", firstArm));
                            locks.get(firstArm).lock();
                            emit(Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", firstArm));

                            emit(Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", secondArm));
                            locks.get(secondArm).lock();
                            emit(Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", secondArm));
                        }
                    }

                    // Trabalha com os dois braços
                    Thread.sleep(600);

                    // Libera ambos os braços
                    locks.get(secondArm).unlock();
                    emit(Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", secondArm));

                    locks.get(firstArm).unlock();
                    emit(Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", firstArm));

                    emit(Map.of("type", "DONE", "spaceCraftId", shipId));

                } catch (Exception ignored) {}
            });

            shipThreads.add(t);
            activeThreads.add(t);
            t.start();
        }

        // Thread monitora do ciclo de Deadlock
        Thread monitor = new Thread(() -> {
            try {
                if (!hasDeadlock) {
                    // Sem ciclo de deadlock (ex: ships < arms): aguarda todas terminarem
                    for (Thread t : shipThreads) {
                        t.join();
                    }
                    emit(Map.of("type", "SYNC_END", "reason", "COMPLETED"));
                    return;
                }

                Thread.sleep(900); // espera o impasse se formar

                if ("none".equals(recovery)) {
                    // Modo deixar travar: detecta o ciclo, acende a luz vermelha e para travado
                    emit(Map.of("type", "DEADLOCK_DETECTED", "spaceCraftIds", cycleShips));
                    Thread.sleep(800);
                    emit(Map.of("type", "SYNC_END", "reason", "DEADLOCKED"));

                } else if ("detection".equals(recovery)) {
                    // Modo detecção: acende o ciclo e aborta a maior nave DENTRO do ciclo
                    emit(Map.of("type", "DEADLOCK_DETECTED", "spaceCraftIds", cycleShips));
                    Thread.sleep(800);

                    int victimIndex = ringSize - 1;
                    String victim = shipIds.get(victimIndex);
                    emit(Map.of("type", "VICTIM_ABORTED", "spaceCraftId", victim));

                    // Notifica a thread da vítima para abortar e soltar o braço
                    Thread victimThread = shipThreads.get(victimIndex);
                    victimThread.interrupt();

                    // Aguarda todas as naves concluírem suas tarefas
                    for (Thread t : shipThreads) {
                        t.join();
                    }
                    emit(Map.of("type", "SYNC_END", "reason", "COMPLETED"));

                } else if ("timeout".equals(recovery)) {
                    for (Thread t : shipThreads) {
                        t.join();
                    }
                    emit(Map.of("type", "SYNC_END", "reason", "COMPLETED"));
                }

            } catch (InterruptedException ignored) {}
        });

        activeThreads.add(monitor);
        monitor.start();
    }

    public synchronized void start(String scenario, boolean sync, String recovery, int ships, int arms) {
    stop(); // para qualquer cenário antigo
    this.running = true;
    this.seq.set(0);
    this.startTime = System.currentTimeMillis();

    // Cria os nomes das naves: N1, N2, N3...
    List<String> shipIds = new ArrayList<>();
    for (int i = 1; i <= ships; i++) {
        shipIds.add("N" + i);
    }

    if ("race".equals(scenario)) {
        startRaceScenario(sync, ships, arms, shipIds);
    } else if ("deadlock".equals(scenario)) {
        startDeadlockScenario(recovery, ships, arms, shipIds);
    }
}
}