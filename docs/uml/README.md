# Promethean — UML de referência

Este documento é o **mapa do projeto**: ele mostra as classes que já existem, as que ainda serão criadas e como elas conversam.
Os diagramas estão em [Mermaid](https://mermaid.js.org/), que o GitHub renderiza direto nesta página. Para alterar um diagrama, edite o bloco de texto correspondente.

> O UML descreve o **alvo**. O código atual ainda não está assim. A seção 7 mostra o que muda em cada classe e em qual fase.

**Sumário**

1. [Mapa de pacotes e status](#1-mapa-de-pacotes-e-status)
2. [Classes — domínio e escalonadores](#2-classes--domínio-e-escalonadores)
3. [Classes — motor, eventos e métricas](#3-classes--motor-eventos-e-métricas)
4. [Ciclo de vida de uma nave (estados)](#4-ciclo-de-vida-de-uma-nave-estados)
5. [Um tick do clock, passo a passo](#5-um-tick-do-clock-passo-a-passo)
6. [Fase 4 — sincronização e interface web](#6-fase-4--sincronização-e-interface-web)
7. [Checklist por classe](#7-checklist-por-classe)
8. [Como ler a notação UML](#8-como-ler-a-notação-uml)

---

## 1. Mapa de pacotes e status

Cada caixa é uma classe. A cor indica o que falta fazer.

| Cor | Significado |
|---|---|
| 🟧 Laranja | Já existe no repositório, mas precisa ser completada/ajustada (Fase 1–2) |
| 🟦 Azul | Criar no núcleo — **Fase 2** (garante o requisito de 2 algoritmos) |
| 🟪 Roxo | Criar como diferencial — **Fase 3** |
| ⬜ Cinza tracejado | Extras do README — **Fase 4** |

```mermaid
flowchart TB
    Main["Main<br/>ponto de entrada"]:::existe

    subgraph MODEL["model/ — os dados (PCB e CPU)"]
        SC["SpaceCraft<br/>processo / PCB"]:::existe
        PS["ProcessState<br/>estados"]:::existe
        DP["DockingPort<br/>núcleo de CPU"]:::existe
        SM["SimulationMetrics<br/>resultado final"]:::existe
        WL["Workload<br/>carga de trabalho"]:::fase3
    end

    subgraph SCHED["scheduler/ — as políticas"]
        SI["Scheduler<br/>interface"]:::existe
        FC["FcfsScheduler"]:::fase2
        RR["RoundRobinScheduler"]:::fase2
        PA["PriorityAgingScheduler"]:::fase3
    end

    subgraph ENGINE["engine/ — o mecanismo"]
        EN["SimulationEngine<br/>clock + dispatcher"]:::fase2
        EV["SimulationEvent<br/>EventType"]:::fase2
        LI["SimulationListener<br/>interface"]:::fase2
        CG["ConsoleGanttPrinter"]:::fase2
    end

    subgraph METRICS["metrics/"]
        MC["MetricsCollector"]:::fase2
    end

    subgraph FUT["sync/ e server/ — extras"]
        SQ["SharedReadyQueue"]:::fase4
        SR["SubsystemResourceManager"]:::fase4
        AB["AirlockBarrier"]:::fase4
        WS["WebSocketServer"]:::fase4
    end

    Main --> EN
    Main --> WL
    Main --> SI
    FC -.implementa.-> SI
    RR -.implementa.-> SI
    PA -.implementa.-> SI
    EN --> SI
    EN --> DP
    EN --> SC
    EN --> MC
    EN --> LI
    DP --> SC
    SC --> PS
    MC --> SM
    CG -.implementa.-> LI
    WS -.implementa.-> LI
    EN -.fase 4.-> SR
    EN -.fase 4.-> SQ
    SR -.-> AB

    classDef existe fill:#fde7c4,stroke:#b86e12,color:#2d1a02,stroke-width:1.5px
    classDef fase2 fill:#d7e4ff,stroke:#2f56b0,color:#0c1a3d,stroke-width:1.5px
    classDef fase3 fill:#eadcff,stroke:#6b3fb8,color:#231040,stroke-width:1.5px
    classDef fase4 fill:#eef0f3,stroke:#7a828e,color:#2a2f36,stroke-dasharray:5 4
```

**A ideia central:** o `SimulationEngine` é o **mecanismo** (dono do clock e das portas). O `Scheduler` é a **política** (dono da fila de prontos). O motor pergunta, o escalonador decide. Por isso trocar de algoritmo é só trocar o objeto `Scheduler` (padrão *Strategy*).

---

## 2. Classes — domínio e escalonadores

```mermaid
classDiagram
    direction TB

    class ProcessState {
        <<enumeration>>
        NEW
        READY
        RUNNING
        BLOCKED
        FINISHED
    }

    class SpaceCraft {
        -String id
        -int arrivalTime
        -int burstTime
        -int remainingTime
        -int basePriority
        -int currentPriority
        -int waitingTime
        -int startTime
        -int finishTime
        -int timeInCurrentState
        -ProcessState state
        +SpaceCraft(id, arrivalTime, burstTime, basePriority)
        +executeTick() void
        +waitTick() void
        +isFinished() boolean
        +markStart(int now) void
        +markFinish(int now) void
        +age(int boost) void
        +resetPriority() void
        +setState(ProcessState s) void
        +getTurnaroundTime() int
        +getResponseTime() int
    }

    class DockingPort {
        -String id
        -SpaceCraft current
        -int quantumUsed
        +DockingPort(String id)
        +isIdle() boolean
        +dock(SpaceCraft s) void
        +undock() SpaceCraft
        +tick() void
        +getCurrent() SpaceCraft
        +getQuantumUsed() int
    }

    class Scheduler {
        <<interface>>
        +name() String
        +addToReady(SpaceCraft s, int now) void
        +selectNext(int now) SpaceCraft
        +shouldPreempt(SpaceCraft running, DockingPort port, int now) boolean
        +onTick(int now) void
        +hasReady() boolean
    }

    class FcfsScheduler {
        -Deque~SpaceCraft~ queue
    }

    class RoundRobinScheduler {
        -Deque~SpaceCraft~ queue
        -int quantum
    }

    class PriorityAgingScheduler {
        -List~SpaceCraft~ ready
        -int agingInterval
        -int agingBoost
    }

    SpaceCraft --> ProcessState : state
    DockingPort --> "0..1" SpaceCraft : nave atracada
    Scheduler <|.. FcfsScheduler
    Scheduler <|.. RoundRobinScheduler
    Scheduler <|.. PriorityAgingScheduler
    Scheduler ..> SpaceCraft : ordena
    Scheduler ..> DockingPort : lê quantumUsed
```

**Como ler este diagrama**

- `SpaceCraft` é o **PCB**. Os atributos são a ficha do processo. Os métodos são os únicos jeitos de alterar essa ficha:
  - `executeTick()`: nave em RUNNING consome 1 de CPU (`remainingTime--`).
  - `waitTick()`: nave em READY acumula espera (`waitingTime++`, `timeInCurrentState++`).
  - `markStart` / `markFinish`: registram os tempos usados nas métricas. `markStart` só grava na **primeira** vez (`startTime == -1`).
  - `age` / `resetPriority`: aging. Número **menor** = prioridade **maior**, então `age` **diminui** `currentPriority` (mínimo 0).
- `DockingPort` é um **núcleo de CPU**. `quantumUsed` conta quantos ticks a nave atual já usou; o Round Robin decide olhando esse número.
- Os três escalonadores só diferem em **dois pontos**: o tipo de fila e a regra de `shouldPreempt`.

| Algoritmo | Fila | `shouldPreempt` | `onTick` |
|---|---|---|---|
| FCFS | `ArrayDeque` (FIFO) | sempre `false` | nada |
| Round Robin | `ArrayDeque` (FIFO) | `quantumUsed >= quantum && hasReady()` | nada |
| Prioridade + Aging | `List` (procura o menor `currentPriority`) | existe na fila alguém com prioridade menor que a da nave atual | a cada `agingInterval` ticks em READY, chama `age(agingBoost)` |

> Por que `List` e não `PriorityQueue` na prioridade? O `PriorityQueue` não reordena um item cuja prioridade mudou depois de inserido. Com aging, a prioridade muda o tempo todo.

---

## 3. Classes — motor, eventos e métricas

```mermaid
classDiagram
    direction TB

    class Main {
        +main(String[] args)$
    }

    class Workload {
        -List~SpaceCraft~ spacecrafts
        +fromFile(String path) Workload
        +random(int n, long seed) Workload
        +freshCopy() List~SpaceCraft~
    }

    class SimulationEngine {
        -Scheduler scheduler
        -List~DockingPort~ ports
        -List~SpaceCraft~ all
        -int clock
        -int contextSwitchCost
        -int contextSwitches
        -List~SimulationListener~ listeners
        +SimulationEngine(Scheduler, int portCount, List~SpaceCraft~)
        +addListener(SimulationListener l) void
        +run() SimulationMetrics
        -admitArrivals() void
        -handleRunning() void
        -dispatchIdlePorts() void
        -advanceTime() void
        -emit(EventType type, SpaceCraft s, DockingPort p) void
    }

    class SimulationListener {
        <<interface>>
        +onEvent(SimulationEvent e) void
    }

    class SimulationEvent {
        <<record>>
        int tick
        EventType type
        String spacecraftId
        String portId
    }

    class EventType {
        <<enumeration>>
        ARRIVAL
        DISPATCH
        PREEMPT
        FINISH
        AGING
    }

    class ConsoleGanttPrinter {
        +onEvent(SimulationEvent e) void
        +print() void
    }

    class MetricsCollector {
        +compute(String algorithm, List~SpaceCraft~ finished, int totalTime, int contextSwitches) SimulationMetrics
    }

    class SimulationMetrics {
        <<record>>
        String algorithm
        double avgWaitingTime
        double avgTurnaroundTime
        double avgResponseTime
        double throughput
        int contextSwitches
    }

    class Scheduler {
        <<interface>>
    }
    class DockingPort
    class SpaceCraft

    Main ..> Workload : carrega
    Main ..> SimulationEngine : cria um por algoritmo
    Main ..> Scheduler : escolhe
    SimulationEngine o-- "1" Scheduler : política (Strategy)
    SimulationEngine *-- "1..*" DockingPort : portas
    SimulationEngine --> "*" SpaceCraft : naves
    SimulationEngine --> "*" SimulationListener : notifica (Observer)
    SimulationEngine ..> MetricsCollector : ao final
    SimulationEngine ..> SimulationEvent : cria
    SimulationListener <|.. ConsoleGanttPrinter
    SimulationListener ..> SimulationEvent
    SimulationEvent --> EventType
    MetricsCollector ..> SimulationMetrics : cria
    Workload --> "*" SpaceCraft
```

**Como ler este diagrama**

- `Main` monta tudo: carrega um `Workload`, cria **um motor por algoritmo** e imprime a tabela comparativa.
  - `Workload.freshCopy()` é importante: cada algoritmo precisa receber **naves novas**, porque a simulação altera o estado delas.
- `SimulationEngine` tem o **clock** e as **portas**. Ele não sabe qual algoritmo está rodando; só chama os métodos da interface `Scheduler`.
  - A lista `all` guarda todas as naves. É por ela que o motor chama `waitTick()` nas naves em READY, sem precisar mexer na fila do escalonador.
- **Observer:** o motor não imprime nada. Ele emite `SimulationEvent`s e quem quiser escuta. Hoje é o `ConsoleGanttPrinter`; na Fase 4, o `WebSocketServer` escuta os **mesmos** eventos. Os testes também podem escutar.
- `MetricsCollector` calcula as métricas do README a partir das naves finalizadas:

| Métrica | Fórmula |
|---|---|
| Espera média | média de `waitingTime` |
| Turnaround médio | média de `finishTime − arrivalTime` |
| Resposta média | média de `startTime − arrivalTime` |
| Throughput | naves finalizadas ÷ tempo total |
| Trocas de contexto | contador `contextSwitches` do motor |

> `SimulationMetrics` já existe em `model/`. Pode continuar lá; o diagrama sugere transformá-la em `record` (Java 16+), porque é um resultado imutável.

---

## 4. Ciclo de vida de uma nave (estados)

Cada seta mostra **o evento** e **quais métodos** fazem a transição.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> NEW : new SpaceCraft(...)
    NEW --> READY : chegada · scheduler.addToReady()
    READY --> RUNNING : despacho · selectNext() + port.dock() + markStart()
    RUNNING --> READY : preempção · shouldPreempt() → undock() + addToReady()
    RUNNING --> FINISHED : isFinished() · markFinish() + undock()
    RUNNING --> BLOCKED : pede recurso (Fase 4)
    BLOCKED --> READY : recurso liberado (Fase 4)
    FINISHED --> [*]

    note right of READY
        a cada tick: waitTick()
        (espera e aging)
    end note
    note right of RUNNING
        a cada tick: executeTick()
        (consome o burst)
    end note
```

> O enum atual tem `WAITING` e `TERMINATED`. O alvo usa só `BLOCKED` (mesmo significado de `WAITING`) e `FINISHED` (nome usado no README).

---

## 5. Um tick do clock, passo a passo

A **ordem** destes passos muda os resultados, principalmente no Round Robin. Esta é a convenção dos livros: quem chega no tick `t` entra na fila **antes** de quem foi preemptado no mesmo tick.

```mermaid
sequenceDiagram
    autonumber
    participant E as SimulationEngine
    participant S as Scheduler
    participant P as DockingPort
    participant N as SpaceCraft
    participant L as Listener

    Note over E: início do tick (clock = t)

    rect rgba(47, 86, 176, 0.08)
    Note over E,N: 1 · chegadas
    loop cada nave com arrivalTime == t
        E->>N: setState(READY)
        E->>S: addToReady(nave, t)
        E-->>L: ARRIVAL
    end
    end

    rect rgba(107, 63, 184, 0.08)
    Note over E,S: 2 · manutenção
    E->>S: onTick(t)
    Note right of S: aging (só Prioridade)
    end

    rect rgba(184, 110, 18, 0.08)
    Note over E,N: 3 · portas ocupadas
    loop cada porta ocupada
        E->>N: isFinished()
        alt terminou
            E->>N: markFinish(t) + setState(FINISHED)
            E->>P: undock()
            E-->>L: FINISH
        else ainda falta burst
            E->>S: shouldPreempt(nave, porta, t)
            opt resposta true
                E->>P: undock()
                E->>N: setState(READY)
                E->>S: addToReady(nave, t)
                E-->>L: PREEMPT
            end
        end
    end
    end

    rect rgba(47, 130, 90, 0.08)
    Note over E,N: 4 · despacho
    loop cada porta livre enquanto hasReady()
        E->>S: selectNext(t)
        S-->>E: nave
        E->>P: dock(nave)
        E->>N: markStart(t)
        E-->>L: DISPATCH
    end
    end

    Note over E,N: 5 · execução
    E->>P: tick()
    P->>N: executeTick()
    E->>N: waitTick() nas naves em READY
    Note over E: clock++
```

**Custo da troca de contexto (Δt), Fase 3:** quando uma porta recebe uma nave diferente da anterior, ela fica `contextSwitchCost` ticks "manobrando" antes de a nave começar a executar. O motor soma 1 em `contextSwitches` a cada troca.

---

## 6. Fase 4 — sincronização e interface web

Só depois que o núcleo (Fases 1–3) estiver funcionando e testado. O motor determinístico continua gerando as métricas; esta camada mostra as primitivas de sincronização do README.

```mermaid
classDiagram
    direction LR

    class SharedReadyQueue {
        -Deque~SpaceCraft~ queue
        -ReentrantLock lock
        -Condition notEmpty
        +enqueue(SpaceCraft s) void
        +dequeue() SpaceCraft
    }

    class SubsystemResourceManager {
        -Semaphore roboticArm
        -Semaphore telemetryLinks
        +acquire(ResourceType r) void
        +release(ResourceType r) void
    }

    class ResourceType {
        <<enumeration>>
        ROBOTIC_ARM
        TELEMETRY_LINK
    }

    class AirlockBarrier {
        -CyclicBarrier barrier
        +awaitEqualization() void
    }

    class WebSocketServer {
        -Javalin app
        +start(int port) void
        +onEvent(SimulationEvent e) void
    }

    class SimulationListener {
        <<interface>>
    }

    SubsystemResourceManager --> ResourceType
    SubsystemResourceManager ..> AirlockBarrier : usa na liberação
    SimulationListener <|.. WebSocketServer
```

| Classe | Primitiva | Conceito de SO |
|---|---|---|
| `SharedReadyQueue` | `ReentrantLock` + `Condition` | Produtor-consumidor: `dequeue` faz `await()` com a fila vazia; `enqueue` faz `signal()` |
| `SubsystemResourceManager` | `Semaphore(1)` braço, `Semaphore(2)` links | Recurso de capacidade finita; quem não consegue `acquire()` vai para BLOCKED; `release()` sempre no `finally` |
| `AirlockBarrier` | `CyclicBarrier` | Várias threads só seguem quando **todas** chegaram (pressão + trava da escotilha) |
| `WebSocketServer` | Javalin | Envia os mesmos `SimulationEvent`s do console para a página em `localhost:7070` |

---

## 7. Checklist por classe

| Classe | Pacote | Conceito de SO | Situação hoje | O que fazer | Fase |
|---|---|---|---|---|---|
| `ProcessState` | model | Estados do processo | Tem `WAITING` e `TERMINATED` | Deixar `NEW, READY, RUNNING, BLOCKED, FINISHED` | 1 |
| `SpaceCraft` | model | PCB | Campos certos, só getters; `remainingTime` é `final`; tempos em `float` | Tempos em `int`; `remainingTime = burstTime` no construtor; adicionar os métodos da seção 2 | 1 |
| `DockingPort` | model | Núcleo de CPU | `dock`/`undock` prontos; parâmetro inútil no construtor | Construtor só com `id`; renomear `quantumTime` → `quantumUsed`; criar `tick()` e `getCurrent()` | 1 |
| `Scheduler` | scheduler | Escalonador de curto prazo | Interface vazia | Declarar os 6 métodos | 2 |
| `FcfsScheduler` | scheduler | FCFS | — | Criar | 2 |
| `RoundRobinScheduler` | scheduler | RR com quantum | — | Criar | 2 |
| `SimulationEngine` | engine | Dispatcher + clock | — | Criar com 1 porta | 2 |
| `SimulationEvent`, `EventType`, `SimulationListener`, `ConsoleGanttPrinter` | engine | Registro/linha do tempo | — | Criar | 2 |
| `MetricsCollector` | metrics | Métricas de avaliação | — | Criar | 2 |
| `SimulationMetrics` | model | Resultado | Classe vazia | Preencher (ou virar `record`) | 2 |
| `Main` | raiz | — | Vazia | Rodar FCFS e RR e imprimir a tabela | 2 |
| Testes JUnit | `src/test` | — | Não existem | Casos calculados à mão (espera e turnaround) | 2 |
| `PriorityAgingScheduler` | scheduler | Prioridade preemptiva + aging | — | Criar | 3 |
| Várias portas + Δt | engine | Multinúcleo + troca de contexto | — | Estender o motor | 3 |
| `Workload` | model | Carga de trabalho | — | Ler JSON e gerar aleatório com seed | 3 |
| `sync/*`, `server/*` | sync, server | Sincronização e interface | — | Criar | 4 |

---

## 8. Como ler a notação UML

| Símbolo | Nome | Significado neste projeto |
|---|---|---|
| `A <\|.. B` (triângulo, linha tracejada) | Realização | `B` **implementa** a interface `A` (ex.: `FcfsScheduler` implementa `Scheduler`) |
| `A *-- B` (losango cheio) | Composição | `A` **cria e é dono** de `B`; `B` não existe sem `A` (motor → portas) |
| `A o-- B` (losango vazio) | Agregação | `A` **usa** `B`, mas `B` vem de fora (o escalonador é passado ao motor) |
| `A --> B` (seta cheia) | Associação | `A` guarda uma referência para `B` como atributo |
| `A ..> B` (seta tracejada) | Dependência | `A` só usa `B` de passagem (parâmetro, retorno, criação) |
| `"1"`, `"0..1"`, `"*"`, `"1..*"` | Multiplicidade | Quantos objetos participam (ex.: uma porta tem 0 ou 1 nave) |
| `+` / `-` | Visibilidade | `public` / `private` |
| `<<interface>>`, `<<enumeration>>`, `<<record>>` | Estereótipo | Tipo especial de classe em Java |
