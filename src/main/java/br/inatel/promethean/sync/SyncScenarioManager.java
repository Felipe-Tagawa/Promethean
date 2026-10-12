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
    private volatile int runId = 0; // número da execução atual; muda sempre que um cenário termina ou é parado
    private final List<Thread> activeThreads = new ArrayList<>();

    public SyncScenarioManager(WebSocketServer server) {
        this.server = server;
    }

    private synchronized void emit(int run, Map<String, Object> event) {
        if (run != runId) {
            return; // evento de uma execução que já terminou ou foi parada
        }
        Map<String, Object> copy = new HashMap<>(event);
        copy.put("seq", seq.getAndIncrement());
        copy.put("timeMs", System.currentTimeMillis() - startTime);
        server.broadcast(copy);
    }

    public synchronized void stop() {
        if (!running) return;

        // Avisa a tela; é o último evento desta execução
        Map<String, Object> endEvent = new HashMap<>();
        endEvent.put("type", "SYNC_END");
        endEvent.put("reason", "STOPPED");
        emit(runId, endEvent);
        endRun();
    }

    // Encerra a execução atual: a partir daqui nenhuma thread dela consegue emitir
    private void endRun() {
        running = false;
        runId++;
        for (Thread t : activeThreads) {
            if (t != Thread.currentThread()) {
                t.interrupt();
            }
        }
        activeThreads.clear();
    }

    // Chamado pela thread monitora quando o cenário termina sozinho
    private synchronized void finish(int run, Map<String, Object> endEvent) {
        if (run != runId) return;
        emit(run, endEvent);
        endRun();
    }

    private boolean isCurrent(int run) {
        return run == runId;
    }

    private void startRaceScenario(int run, boolean sync, int ships, int arms, List<String> shipIds) {
    
        Map<String, Object> startEvent = new HashMap<>();
        startEvent.put("type", "SYNC_START");
        startEvent.put("scenario", "race");
        startEvent.put("sync", sync);
        startEvent.put("spacecrafts", shipIds);
        startEvent.put("resources", List.of(Map.of("id", "ROBOTIC_ARMS", "capacity", arms)));
        emit(run, startEvent);

        // Recursos compartilhados protegidos por SubSystemResourceManager
        SubSystemResourceManager resourceManager = new SubSystemResourceManager(arms);
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
                    emit(run, Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", "ROBOTIC_ARMS"));

                    if (sync) {
                        resourceManager.acquire(ResourceType.ROBOTIC_ARM); // Bloqueio real via SubSystemResourceManager!
                    }

                    // A nave pegou o braço
                    currentlyUsing.add(shipId);
                    emit(run, Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", "ROBOTIC_ARMS"));

                    // Se não tem sincronismo e ultrapassou a capacidade -- Colide.
                    if (!sync && currentlyUsing.size() > arms) {
                        collisions.incrementAndGet();
                        emit(run, Map.of(
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
                    emit(run, Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", "ROBOTIC_ARMS"));
                    if (sync) {
                        resourceManager.release(ResourceType.ROBOTIC_ARM);
                    }

                    emit(run, Map.of("type", "DONE", "spaceCraftId", shipId));

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
                Map<String, Object> endEvent = new HashMap<>();
                endEvent.put("type", "SYNC_END");
                endEvent.put("reason", "COMPLETED");
                endEvent.put("collisions", collisions.get());
                endEvent.put("cargoExpected", expectedCargo);
                endEvent.put("cargoActual", actualCargo.get());
                finish(run, endEvent);
            } catch (InterruptedException ignored) {}
        });
        activeThreads.add(monitor);
        monitor.start();
    }

    // Cenário do Deadlock dentro de sincronismo
    private void startDeadlockScenario(int run, String recovery, int ships, int arms, List<String> shipIds) {
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
        emit(run, startEvent);

        int shipCount = shipIds.size();
        int armCount = armNames.size();
        int ringSize = Math.min(shipCount, armCount);
        boolean hasDeadlock = shipCount >= armCount && armCount >= 2;
        List<String> cycleShips = shipIds.subList(0, ringSize);

        // Barreira para que apenas as naves do anel peguem o primeiro braço juntas antes de pedir o segundo
        AirLockBarrier barrier = new AirLockBarrier(ringSize);
        // As naves fora do anel só pedem braço depois que todas as do anel pegaram o primeiro
        java.util.concurrent.CountDownLatch ringReady = new java.util.concurrent.CountDownLatch(ringSize);

        List<Thread> shipThreads = new ArrayList<>();

        // Dispara cada nave em sua própria Thread
        for (int i = 0; i < shipCount; i++) {
            final int index = i;
            final String shipId = shipIds.get(i);
            final String firstArm = armNames.get(index % armCount);
            final String secondArm = armNames.get((index + 1) % armCount);

            Thread t = new Thread(() -> {
                try {
                    if (index >= ringSize) {
                        ringReady.await(); // nave extra: espera o anel se formar para não tomar o braço de uma nave dele
                    }

                    // Pede e adquire o primeiro braço
                    emit(run, Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", firstArm));
                    locks.get(firstArm).lock();
                    emit(run, Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", firstArm));

                    // Aguarda apenas as naves do anel pegarem o primeiro braço juntas
                    if (index < ringSize) {
                        ringReady.countDown();
                        barrier.awaitEqualization();
                        Thread.sleep(300);
                    }

                    // Pede o segundo braço (onde o impasse acontece para as naves do anel)
                    emit(run, Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", secondArm));

                    if ("timeout".equals(recovery)) {
                        // MODO TIMEOUT: tenta por tempo limitado (a maior nave do anel desiste primeiro)
                        long timeout = (index == ringSize - 1) ? 500 : 2500;
                        boolean acquired = locks.get(secondArm).tryLock(timeout, java.util.concurrent.TimeUnit.MILLISECONDS);

                        if (!acquired) {
                            // Desiste, solta o primeiro braço e recua
                            emit(run, Map.of("type", "TIMEOUT", "spaceCraftId", shipId, "resourceId", secondArm));
                            locks.get(firstArm).unlock();
                            emit(run, Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", firstArm));

                            // Espera o colega terminar e tenta de novo do zero
                            Thread.sleep(1200);
                            emit(run, Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", firstArm));
                            locks.get(firstArm).lock();
                            emit(run, Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", firstArm));

                            emit(run, Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", secondArm));
                            locks.get(secondArm).lock();
                            emit(run, Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", secondArm));
                        } else {
                            emit(run, Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", secondArm));
                        }
                    } else {
                        // MODO NORMAL OU DETECTION:
                        try {
                            locks.get(secondArm).lockInterruptibly();
                            emit(run, Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", secondArm));
                        } catch (InterruptedException e) {
                            // Solta o primeiro braço
                            locks.get(firstArm).unlock();
                            if (!isCurrent(run)) {
                                return; // interrompida porque o cenário acabou, não como vítima
                            }
                            // Abortada como vítima pelo monitor de deadlock: recua
                            emit(run, Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", firstArm));

                            // Espera o colega terminar e tenta de novo do zero (Rollback & Retry)
                            Thread.sleep(1200);
                            emit(run, Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", firstArm));
                            locks.get(firstArm).lock();
                            emit(run, Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", firstArm));

                            emit(run, Map.of("type", "REQUEST", "spaceCraftId", shipId, "resourceId", secondArm));
                            locks.get(secondArm).lock();
                            emit(run, Map.of("type", "ACQUIRE", "spaceCraftId", shipId, "resourceId", secondArm));
                        }
                    }

                    // Trabalha com os dois braços
                    Thread.sleep(600);

                    // Libera ambos os braços
                    locks.get(secondArm).unlock();
                    emit(run, Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", secondArm));

                    locks.get(firstArm).unlock();
                    emit(run, Map.of("type", "RELEASE", "spaceCraftId", shipId, "resourceId", firstArm));

                    emit(run, Map.of("type", "DONE", "spaceCraftId", shipId));

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
                    finish(run, Map.of("type", "SYNC_END", "reason", "COMPLETED"));
                    return;
                }

                Thread.sleep(900); // espera o impasse se formar

                if ("none".equals(recovery)) {
                    // Modo deixar travar: detecta o ciclo, acende a luz vermelha e para travado
                    emit(run, Map.of("type", "DEADLOCK_DETECTED", "spaceCraftIds", cycleShips));
                    Thread.sleep(800);
                    finish(run, Map.of("type", "SYNC_END", "reason", "DEADLOCKED"));

                } else if ("detection".equals(recovery)) {
                    // Modo detecção: acende o ciclo e aborta a maior nave DENTRO do ciclo
                    emit(run, Map.of("type", "DEADLOCK_DETECTED", "spaceCraftIds", cycleShips));
                    Thread.sleep(800);

                    int victimIndex = ringSize - 1;
                    String victim = shipIds.get(victimIndex);
                    emit(run, Map.of("type", "VICTIM_ABORTED", "spaceCraftId", victim));

                    // Notifica a thread da vítima para abortar e soltar o braço
                    Thread victimThread = shipThreads.get(victimIndex);
                    victimThread.interrupt();

                    // Aguarda todas as naves concluírem suas tarefas
                    for (Thread t : shipThreads) {
                        t.join();
                    }
                    finish(run, Map.of("type", "SYNC_END", "reason", "COMPLETED"));

                } else if ("timeout".equals(recovery)) {
                    for (Thread t : shipThreads) {
                        t.join();
                    }
                    finish(run, Map.of("type", "SYNC_END", "reason", "COMPLETED"));
                }

            } catch (InterruptedException ignored) {}
        });

        activeThreads.add(monitor);
        monitor.start();
    }

    public synchronized void start(String scenario, boolean sync, String recovery, int ships, int arms) {
    stop(); // para qualquer cenário antigo
    this.running = true;
    final int run = this.runId;
    this.seq.set(0);
    this.startTime = System.currentTimeMillis();

    // Cria os nomes das naves: N1, N2, N3...
    List<String> shipIds = new ArrayList<>();
    for (int i = 1; i <= ships; i++) {
        shipIds.add("N" + i);
    }

    if ("race".equals(scenario)) {
        startRaceScenario(run, sync, ships, arms, shipIds);
    } else if ("deadlock".equals(scenario)) {
        startDeadlockScenario(run, recovery, ships, arms, shipIds);
    }
}
}