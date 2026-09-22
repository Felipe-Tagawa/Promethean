# Promethean: Simulador de Escalonamento e Sincronização de Recursos

O Promethean é um simulador de sistemas operacionais desenvolvido em Java que modela o controle de tráfego, acoplamento e compartilhamento de subsistemas em uma estação orbital. O objetivo principal é comparar algoritmos clássicos de escalonamento de CPU e demonstrar o tratamento de condições de corrida, contenção e exclusão mútua usando primitivas de sincronização.

## 1. Analogia: Estação Espacial vs. Sistemas Operacionais

Para tornar os conceitos abstratos visuais e intuitivos, cada componente da estação espacial reflete diretamente uma estrutura de SO:

| Elemento da Estação | Conceito de SO | Descrição Técnica |
|---|---|---|
| Nave Espacial (Spacecraft) | Processo / PCB | Entidade de trabalho com ID, tempo de chegada (Arrival Time), tempo total de manobra (Burst Time), prioridade e estado. |
| Portas de Acoplamento (DockingPort) | Núcleos de CPU | Recursos de execução principal onde as naves atracam para processar suas rotinas. Podem operar em modo mononúcleo ou multinúcleo. |
| Órbita de Espera (Parking Orbit) | Fila de Prontos (Ready Queue) | Fila de processos no estado READY aguardando alocação em uma porta de acoplamento. |
| Câmara / Braço Robótico | Recursos Compartilhados (I/O) | Recursos periféricos limitados. Quando requisitados, a nave sai da porta e vai para o estado BLOCKED. |
| Manobra de Recuo | Troca de Contexto | Custo temporal ($\Delta t$) para retirar uma nave preemptada da porta e alocar outra. |

## 2. Estados dos Processos (ProcessState)

O ciclo de vida de uma nave obedece à máquina de estados clássica de SO:

```
[ NEW ] ──> [ READY ] <─── Preempção / Fim de Quantum ───┐
                │                                         │
             Despacho (Scheduler)                         │
                ▼                                         │
           [ RUNNING ] ───────────────────────────────────┘
                │
         Requisita Recurso (I/O)
                ▼
           [ BLOCKED ] ─── Liberação do Recurso ──> [ READY ]
                │
          Conclusão do Burst
                ▼
          [ FINISHED ]
```

- **NEW**: Nave detectada pelos radares da estação, prestes a entrar na órbita.
- **READY**: Nave posicionada na órbita de espera, apta a atracar assim que houver porta livre.
- **RUNNING**: Nave atracada em uma porta executando suas tarefas (consumindo ciclos de CPU).
- **BLOCKED**: Nave aguardando liberação de subsistema exclusivo (ex.: braço robótico ou câmara de descompressão).
- **FINISHED**: Tarefas finalizadas; nave desatracada e métricas computadas.

## 3. Algoritmos de Escalonamento Implementados

O simulador permite executar a mesma carga de trabalho (workload) sob diferentes políticas de escalonamento para comparação direta de desempenho:

### A. Preemptive Priority Scheduling com Aging

**Política**: A nave de maior prioridade (menor valor numérico) sempre assume a porta. Se uma cápsula de emergência chega enquanto um cargueiro está na porta, ocorre preempção: o cargueiro volta para o início da fila de prontos e a emergência atraca.

**Prevenção de Starvation (Aging)**: Para evitar que módulos científicos de baixa prioridade fiquem indefinidamente na fila, a cada $k$ ciclos de clock na fila de espera, a prioridade da nave recebe um incremento dinâmico (boost).

### B. Round Robin (RR)

**Política**: Todas as naves recebem fatias iguais de tempo de acoplamento (Quantum). Ao expirar o quantum sem finalizar o burst, a nave cede a porta e retorna para o fim da fila de prontos.

**Foco**: Distribuição justa de tempo e redução da variância no tempo de resposta.

### C. First-Come, First-Served (FCFS) — Baseline de Controle

**Política**: Atendimento estritamente por ordem cronológica de chegada na órbita.

**Objetivo Acadêmico**: Demonstrar o efeito de comboio (convoy effect), onde naves rápidas ficam travadas atrás de um cargueiro longo.

## 4. Primitivas de Sincronismo Utilizadas

O projeto utiliza a API nativa de concorrência do Java (`java.util.concurrent`):

- **ReentrantLock & Condition (SharedReadyQueue)**: Implementação do padrão Produtor-Consumidor na fila de órbita. A thread geradora insere naves (`enqueue`), e as threads das portas consomem (`dequeue`), suspendendo via `await()` quando a fila está vazia e acordando via `signal()` quando uma nave chega.
- **Semaphore (SubsystemResourceManager)**: Controla a ocupação de subsistemas de capacidade finita (ex.: apenas 1 braço robótico de estivagem e 2 links de transmissão de telemetria). Naves tentam `acquire()` para usar o recurso e executam `release()` no bloco `finally`.
- **CyclicBarrier (AirlockBarrier)**: Sincronização entre subsistemas independentes (ex.: confirmação simultânea de equalização de pressão e trava mecânica da escotilha antes da liberação final).

## 5. Métricas de Avaliação

Ao final de cada execução, o simulador consolida:

- **Tempo Médio de Espera ($W_m$)**: Somatório do tempo passado em READY dividido pelo total de naves.
- **Tempo Médio de Retorno / Turnaround ($TAT_m$)**: Intervalo entre a detecção (`arrivalTime`) e a conclusão (`finishTime`).
- **Taxa de Throughput**: Quantidade de naves finalizadas por unidade de tempo de clock.
- **Trocas de Contexto**: Total de manobras de desalocação/preempção forçada na porta.

## 6. Estrutura de Diretórios

```
src/main/java/br/inatel/orbital/
├── Main.java                        # Ponto de entrada da aplicação
├── model/                           # Entidades de domínio (Spacecraft, ProcessState, etc.)
├── scheduler/                       # Estratégias de escalonamento (Priority, RR, FCFS)
├── sync/                            # Fila concorrente, semáforos e barreiras
└── server/                          # Servidor WebSocket / Javalin para a interface
```

## 7. Compilação e Execução

### Pré-requisitos

- Java JDK 21+ instalado
- Apache Maven 3.8+

### Execução via Terminal

```bash
# Clonar o repositório
git clone <url-do-repositorio>
cd promethean

# Compilar e rodar testes unitários
mvn clean test

# Executar a simulação
mvn compile exec:java -Dexec.mainClass="br.inatel.promethean.Main"
```

A interface web de visualização estará disponível em `http://localhost:7070` assim que o motor iniciar.
