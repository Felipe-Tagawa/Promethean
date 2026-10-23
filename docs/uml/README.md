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
        WL["Workload<br/>carga de trabalho"]:::fase3
    end

    subgraph SCHED["scheduler/ — as políticas"]
        SI["Scheduler<br/>interface"]:::existe
        FC["FcfsScheduler"]:::fase2
        SJF["SJFScheduler"]:::fase2
        PA["PriorityScheduler"]:::fase3
        CT["SchedulerCatalog<br/>chave → escalonador"]:::fase2
    end

    subgraph ENGINE["engine/ — o mecanismo"]
        EN["SimulationEngine<br/>clock + dispatcher"]:::fase2
        EV["SimulationEvent<br/>EventType"]:::fase2
        LI["SimulationListener<br/>interface"]:::fase2
        SM["SimulationMetrics<br/>resultado final"]:::fase2
        RC["SimulationRecorder<br/>grava a simulação"]:::fase2
        RG["SimulationRecording<br/>gravação para a tela"]:::fase2
    end

    subgraph CLI["cli/ — interface e visualização terminal"]
        CG["ConsoleGanttPrinter"]:::fase2
    end

    subgraph FUT["sync/ e server/ — concorrência e web"]
        SQ["SharedReadyQueue"]:::fase4
        SR["SubSystemResourceManager"]:::fase4
        AB["AirLockBarrier"]:::fase4
        SS["SyncScenarioManager"]:::fase4
        WS["WebSocketServer"]:::fase4
    end

    subgraph EXCEPTION["exception/ — domínio e tratamento de erros"]
        EX["Exceções Customizadas<br/>InvalidValueException<br/>InvalidProcessStateException<br/>PortOccupiedException<br/>SimulationTimeoutException"]:::existe
    end

    Main --> EN
    Main --> WL
    Main --> SI
    Main --> CG
    Main -.fase 4.-> SQ
    FC -.implementa.-> SI
    SJF -.implementa.-> SI
    PA -.implementa.-> SI
    EN --> SI
    EN --> DP
    EN --> SC
    EN --> LI
    EN --> SM
    DP --> SC
    SC --> PS
    CG -.implementa.-> LI
    WS -.implementa.-> LI
    WS --> SS
    WS --> CT
    WS --> RC
    CT --> SI
    RC --> EN
    RC --> WL
    RC --> RG
    SS --> SR
    SS --> AB

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
        +DockingPort(String id)
        +isIdle() boolean
        +dock(SpaceCraft s) void
        +undock() SpaceCraft
        +tick() void
        +getCurrent() SpaceCraft
        +getId() String
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

    class SJFScheduler {
        -Deque~SpaceCraft~ queue
    }

    class PriorityScheduler {
        -List~SpaceCraft~ readyQueue
        -int agingInterval
        -int agingBoost
    }

    SpaceCraft --> ProcessState : state
    DockingPort --> "0..1" SpaceCraft : nave atracada
    Scheduler <|.. FcfsScheduler
    Scheduler <|.. SJFScheduler
    Scheduler <|.. PriorityScheduler
    Scheduler ..> SpaceCraft : ordena
```

**Como ler este diagrama**

- `SpaceCraft` é o **PCB**. Os atributos são a ficha do processo. Os métodos são os únicos jeitos de alterar essa ficha:
  - `executeTick()`: nave em RUNNING consome 1 de CPU (`remainingTime--`).
  - `waitTick()`: nave em READY acumula espera (`waitingTime++`, `timeInCurrentState++`).
  - `markStart` / `markFinish`: registram os tempos usados nas métricas. `markStart` só grava na **primeira** vez (`startTime == -1`).
  - `age` / `resetPriority`: aging. Número **menor** = prioridade **maior**, então `age` **diminui** `currentPriority` (mínimo 0).
    `resetPriority` devolve a nave à `basePriority` e é chamado pelo motor quando ela é **preemptada**, não quando atraca (ver a nota da seção 5).
- `DockingPort` é um **núcleo de CPU** onde as naves atracam para executar suas rotinas.
- Os três escalonadores só diferem em **dois pontos**: a política de seleção na fila e a regra de `shouldPreempt`.

| Algoritmo | Fila | `shouldPreempt` | `onTick` |
|---|---|---|---|
| FCFS | `ArrayDeque` (FIFO) | sempre `false` | nada |
| SJF | `ArrayDeque` (menor `burstTime`) | sempre `false` | nada |
| SJF Preemptivo | `ArrayDeque` (menor `remainingTime`) | existe na fila alguém com tempo restante menor que o da nave atual | nada |
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
        -int contextSwitches
        -List~SimulationListener~ listeners
        +SimulationEngine(Scheduler, int portCount, List~SpaceCraft~)
        +addListener(SimulationListener l) void
        +run() SimulationMetrics
        +getPortIds() List~String~
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

    class SchedulerCatalog {
        +list()$ List~Entry~
        +create(String key)$ Scheduler
    }

    class SimulationRecorder {
        +recordSimulation(Scheduler scheduler)$ SimulationRecording
    }

    class SimulationRecording {
        <<record>>
        int version
        String algorithm
        List~String~ ports
        List~SpaceCraft~ spacecrafts
        List~SimulationEvent~ events
        SimulationMetrics metrics
    }

    class ConsoleGanttPrinter {
        +onEvent(SimulationEvent e) void
        +print(SimulationMetrics metrics) void
    }

    class SimulationMetrics {
        <<record>>
        String algorithm
        double avgWaitingTime
        double avgTurnaroundTime
        double avgResponseTime
        double throughput
        double contextSwitches
    }

    class Scheduler {
        <<interface>>
    }
    class DockingPort
    class SpaceCraft

    Main ..> Workload : carrega
    Main ..> SimulationEngine : cria um por algoritmo
    Main ..> Scheduler : escolhe
    Main ..> ConsoleGanttPrinter : usa
    SimulationEngine o-- "1" Scheduler : política (Strategy)
    SimulationEngine *-- "1..*" DockingPort : portas
    SimulationEngine --> "*" SpaceCraft : naves
    SimulationEngine --> "*" SimulationListener : notifica (Observer)
    SimulationEngine ..> SimulationMetrics : cria ao final
    SimulationEngine ..> SimulationEvent : cria
    SimulationListener <|.. ConsoleGanttPrinter
    SimulationListener ..> SimulationEvent
    SchedulerCatalog ..> Scheduler : cria pela chave
    SimulationRecorder ..> SimulationEngine : roda e escuta
    SimulationRecorder ..> Workload : copia a carga
    SimulationRecorder ..> SimulationRecording : cria
    SimulationRecording --> "*" SimulationEvent
    SimulationRecording --> SimulationMetrics
    SimulationEvent --> EventType
    Workload --> "*" SpaceCraft
```

**Como ler este diagrama**

- `Main` monta tudo: carrega um `Workload`, cria **um motor por algoritmo** e imprime a tabela comparativa.
  - `Workload.freshCopy()` é importante: cada algoritmo precisa receber **naves novas**, porque a simulação altera o estado delas.
- `SimulationEngine` tem o **clock** e as **portas**. Ele não sabe qual algoritmo está rodando; só chama os métodos da interface `Scheduler`.
  - A lista `all` guarda todas as naves. É por ela que o motor chama `waitTick()` nas naves em READY, sem precisar mexer na fila do escalonador.
- **Observer:** o motor não imprime nada. Ele emite `SimulationEvent`s e quem quiser escuta. O `ConsoleGanttPrinter` escuta os eventos para imprimir a linha do tempo e o gráfico de Gantt; o `WebSocketServer` também implementa a interface para o canal web.
- **Gravação para a tela:** o `SimulationRecorder` roda o motor com um listener que guarda cada evento em uma lista e devolve um `SimulationRecording` (naves, portas, eventos e métricas). É o que a rota `GET /api/scheduling` envia ao front, que reproduz a simulação em replay. O `SchedulerCatalog` traduz a chave da URL (`fcfs`, `sjf`, `priority`) em um escalonador novo e é a única fonte da lista de algoritmos.
- O próprio `SimulationEngine` calcula as métricas do README a partir das naves finalizadas:

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
    RUNNING --> READY : preempção · shouldPreempt() → undock() + resetPriority() + addToReady()
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

A **ordem** destes passos segue a convenção clássica dos livros de SO: quem chega no tick `t` entra na fila **antes** de quem foi preemptado no mesmo tick.

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
                E->>N: setState(READY) + resetPriority()
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

**Quando a prioridade envelhecida é desfeita:** o motor chama `resetPriority()` na **preempção**, junto com o `setState(READY)`, e não no despacho. Enquanto está na porta, a nave mantém a prioridade que conquistou pelo aging; ao voltar para a órbita, recomeça da `basePriority`. Se o reset fosse feito no despacho, a nave perderia o bônus no instante em que atraca e seria expulsa no tick seguinte pela nave que acabou de tirar da porta. Na carga de referência (N1 a N4), isso daria 3 preempções, com N1 e N3 se revezando nos ticks 12 e 13; com o reset na preempção há só 1.

**Troca de contexto:** a troca de contexto entre naves é instantânea (Δt = 0). O motor soma 1 em `contextSwitches` a cada troca.

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

    class SubSystemResourceManager {
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

    class AirLockBarrier {
        -CyclicBarrier barrier
        +awaitEqualization() void
    }

    class SyncScenarioManager {
        +start(scenario, sync, recovery, ships, arms) void
        +stop() void
    }

    class WebSocketServer {
        -Javalin app
        +start(int port) void
        +onEvent(SimulationEvent e) void
    }

    class SimulationListener {
        <<interface>>
    }

    SubSystemResourceManager --> ResourceType
    SyncScenarioManager --> SubSystemResourceManager : usa semáforo
    SyncScenarioManager --> AirLockBarrier : usa barreira
    WebSocketServer --> SyncScenarioManager : orquestra
    SimulationListener <|.. WebSocketServer
```

| Classe | Primitiva | Conceito de SO |
|---|---|---|
| `SharedReadyQueue` | `ReentrantLock` + `Condition` | Produtor-consumidor: `dequeue` faz `await()` com a fila vazia; `enqueue` faz `signal()` |
| `SubSystemResourceManager` | `Semaphore(1)` braço, `Semaphore(2)` links | Recurso de capacidade finita; quem não consegue `acquire()` vai para BLOCKED; `release()` sempre no `finally` |
| `AirLockBarrier` | `CyclicBarrier` | Várias threads só seguem quando **todas** chegaram (equalização da câmara de ar) |
| `SyncScenarioManager` | Threads reais | Orquestrador dos cenários de concorrência, colisão e resolução de deadlocks |
| `WebSocketServer` | Javalin | Servidor web que expõe rotas HTTP e WebSocket em `localhost:7070` |

---

## 7. Checklist por classe

| Classe | Pacote | Conceito de SO | Situação |
|---|---|---|---|
| `ProcessState` | model | Estados do processo | `NEW, READY, RUNNING, BLOCKED, FINISHED` |
| `SpaceCraft` | model | PCB | Tempos em `int`; ciclo de vida e cálculo de métricas |
| `DockingPort` | model | Núcleo de CPU | Alocação (`dock`), desalocação (`undock`) e execução de clock (`tick`) |
| `Scheduler` | scheduler | Escalonador de curto prazo | Interface Strategy com `selectNext`, `shouldPreempt`, `onTick` |
| `FcfsScheduler` | scheduler | FCFS | Implementado com `ArrayDeque` (FIFO) |
| `SJFScheduler` | scheduler | SJF não-preemptivo | Implementado com menor `burstTime` e desempate por chegada |
| `SjfPreemptiveScheduler` | scheduler | SJF preemptivo (SRTF) | Implementado com menor `remainingTime` e preempção |
| `PriorityScheduler` | scheduler | Prioridade preemptiva + aging | Implementado com `List`, preempção e envelhecimento periódico |
| `SchedulerCatalog` | scheduler | Escolha da política | Lista os algoritmos e cria o escalonador a partir da chave recebida pela rota |
| `SimulationEngine` | engine | Dispatcher + clock | Motor com admissão, despacho, execução e cálculo de métricas |
| `SimulationEvent`, `EventType`, `SimulationListener` | engine | Registro e Observer | Eventos de simulação e padrão Observer |
| `SimulationMetrics` | engine | Resultado | Record com médias de espera, resposta, retorno, vazão e trocas de contexto |
| `SimulationRecorder`, `SimulationRecording` | engine | Registro para replay | Roda o motor guardando os eventos e devolve a gravação que a tela reproduz |
| `ConsoleGanttPrinter` | cli | Visualização | Linha do tempo, Diagrama de Gantt textual e métricas formatadas |
| `Workload` | model | Carga de trabalho | Carga de referência oficial e clonagem com `freshCopy()` |
| `SharedReadyQueue` | sync | Produtor-Consumidor | Fila protegida por `ReentrantLock` e `Condition notEmpty` |
| `SubSystemResourceManager`, `ResourceType` | sync | Semáforo contador | Gestão de recursos com `Semaphore` para braço robótico e telemetria |
| `AirLockBarrier` | sync | Barreira cíclica | Sincronização de threads com `CyclicBarrier` |
| `SyncScenarioManager` | sync | Concorrência viva | Execução real de threads com detecção de colisões e deadlocks |
| `WebSocketServer` | server | Web & WebSocket | Javalin servindo front-end estático, APIs REST e canal `/ws/sync` |
| `InvalidValueException`, `InvalidProcessStateException`, `PortOccupiedException`, `SimulationTimeoutException` | exception | Exceções de domínio | Tratamento robusto de valores inválidos, estados ilegais, portas ocupadas e timeouts |
| `Main` | raiz | Ponto de entrada | Inicialização do servidor web, simulação comparativa e demo concorrente |

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
