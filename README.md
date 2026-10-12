# Promethean: Simulador de Escalonamento e Sincronização de Recursos

O **Promethean** é um simulador de conceitos centrais de Sistemas Operacionais desenvolvido em **Java 21**, modelando o tráfego espacial, acoplamento e compartilhamento de subsistemas em uma estação orbital. 

O projeto une rigor conceitual acadêmico com uma interface visual interativa em tempo real (HTML5/SVG/WebSockets), permitindo comparar algoritmos de escalonamento de CPU e demonstrar condições de corrida, contenção e impasses (*deadlocks*) utilizando threads reais e primitivas de sincronização.

---

## 1. Analogia: Estação Espacial vs. Sistemas Operacionais

Para tornar os conceitos abstratos visuais e intuitivos, cada componente da estação espacial reflete diretamente uma estrutura de SO:

| Elemento da Estação | Conceito de SO | Descrição Técnica |
|---|---|---|
| **Nave Espacial (`SpaceCraft`)** | **Processo / PCB** | Entidade de trabalho com ID, tempo de chegada (*Arrival Time*), tempo total de manobra (*Burst Time*), prioridades (base e dinâmica) e estado. |
| **Porta de Acoplamento (`DockingPort`)** | **Núcleo de CPU** | Recurso de processamento principal onde as naves atracam para consumir ciclos de clock. |
| **Órbita de Espera (*Parking Orbit*)** | **Fila de Prontos (*Ready Queue*)** | Fila de processos no estado `READY` aguardando despacho para uma porta livre. |
| **Braço Robótico / Telemetria** | **Recursos Compartilhados (I/O)** | Recursos periféricos finitos. Quando requisitados, a nave sai da porta e vai para o estado `BLOCKED`. |
| **Manobra de Recuo** | **Troca de Contexto** | Custo temporal de chaveamento de contexto para desalocar uma nave preemptada da porta e atracar outra. |

---

## 2. Ciclo de Vida dos Processos (`ProcessState`)

O ciclo de vida de uma nave segue fielmente a máquina de estados clássica de SO:

```
[ NEW ] ──> [ READY ] <─── Preempção ────────────────────────┐
                │                                            │
             Despacho (Scheduler)                            │
                ▼                                            │
           [ RUNNING ] ──────────────────────────────────────┘
                │
         Requisita Recurso (I/O)
                ▼
           [ BLOCKED ] ─── Liberação do Recurso ──> [ READY ]
                │
          Conclusão do Burst
                ▼
           [ FINISHED ]
```

- **NEW**: Nave detectada pelos radares da estação, prestes a ingressar na órbita.
- **READY**: Nave posicionada na órbita de espera, apta a atracar assim que houver porta livre.
- **RUNNING**: Nave atracada em uma porta executando suas tarefas (consumindo ciclos de CPU).
- **BLOCKED**: Nave aguardando liberação de subsistema exclusivo (ex.: braço robótico ou câmara de descompressão).
- **FINISHED**: Tarefas concluídas; nave desatracada e métricas computadas.

---

## 3. Algoritmos de Escalonamento Implementados

O simulador permite executar a mesma carga de trabalho (*workload*) sob diferentes políticas de escalonamento para comparação direta de métricas:

### A. Preemptive Priority Scheduling com Aging
* **Política**: A nave de maior prioridade (menor valor numérico) sempre assume a porta. Se uma nave mais prioritária chega enquanto outra está atracada, ocorre preempção: a nave atual desatraca, retorna para a fila de prontos e a nova assume a porta.
* **Prevenção de Inanição (*Aging*)**: A cada $k$ ciclos de clock na fila de espera, a prioridade da nave recebe um incremento dinâmico (*boost*), impedindo *starvation* de processos menos prioritários.

### B. Shortest Job First (SJF)
* **Política**: Abordagem não-preemptiva que prioriza a nave com menor tempo de execução restante (`burstTime`). 
* **Desempate**: Em caso de empate no burst, o desempate é feito pela ordem cronológica de chegada na órbita (`arrivalTime`).
* **Foco**: Minimização do tempo médio de espera entre abordagens não-preemptivas.

### C. First-Come, First-Served (FCFS) — Baseline
* **Política**: Atendimento estritamente por ordem cronológica de chegada na órbita de espera (FIFO).
* **Foco Didático**: Demonstração do clássico **efeito de comboio** (*convoy effect*), onde naves com burst curto ficam bloqueadas atrás de cargueiros pesados.

---

## 4. Primitivas e Cenários de Sincronismo

O módulo de concorrência utiliza a API nativa do Java (`java.util.concurrent`) em threads reais:

### A. Primitivas Nativas (`br.inatel.promethean.sync`)
- **`SharedReadyQueue` (`ReentrantLock` & `Condition`)**: Padrão Produtor-Consumidor concorrente na órbita de espera. O radar insere naves (`enqueue`), e as portas consomem (`dequeue`), suspendendo via `await()` quando vazia e acordando via `signal()` na chegada de novas naves.
- **`SubSystemResourceManager` (`Semaphore`)**: Controle de acesso por semáforo contador (1 braço robótico de estivagem e 2 canais de telemetria). Naves executam `acquire()` e liberam via `release()` em bloco `finally`.
- **`AirLockBarrier` (`CyclicBarrier`)**: Sincronização em *rendezvous* (equalização da pressão e trava mecânica da escotilha devem ser concluídas simultaneamente antes da liberação).

### B. Cenários Vivos com Threads Reais (`sincronismo.html`)
Na interface web, cada nave atua como uma `Thread` real disputando recursos físicos:

1. **Disputa por Braços (*Race Condition*)**:
   - **Com Sincronismo (`sync = true`)**: Acesso protegido por semáforo de capacidade finita. As naves excedentes entram em `BLOCKED` e o contador de carga é atualizado com integridade perfeita.
   - **Sem Sincronismo (`sync = false`)**: Naves acessam a seção crítica simultaneamente, gerando colisões visuais e perda de carga no contador compartilhado (*race condition*).
2. **Impasse (*Deadlock*) — Jantar dos Filósofos em Anel**:
   - Naves disputam braços nomeados em ordem circular cruzada ($N_1$ pega $A$ e pede $B$; $N_2$ pega $B$ e pede $A$).
   - **Grafo de Alocação de Recursos (RAG)**: Detecção visual em tempo real do ciclo de espera circular em SVG.
   - **Estratégias de Resolução**:
     - *Nenhum (`none`)*: O sistema detecta o ciclo, acende alerta de deadlock e encerra travado.
     - *Detecção e Recuperação (`detection`)*: Identifica o ciclo e aborta uma nave vítima (`VICTIM_ABORTED`), liberando o braço para as demais prosseguirem.
     - *Timeout com `tryLock` (`timeout`)*: Naves usam tempo limite de espera; ao expirar, desistem, liberam os recursos segurados e tentam novamente mais tarde.

---

## 5. Resultados e Métricas (Carga de Referência)

Para a carga de referência oficial ($N_1$ a $N_4$):
* **N1**: Chegada 0, Burst 8, Prioridade 3
* **N2**: Chegada 1, Burst 4, Prioridade 1
* **N3**: Chegada 2, Burst 9, Prioridade 4
* **N4**: Chegada 3, Burst 5, Prioridade 2

| Métrica | FCFS | SJF | Prioridade com Aging |
|---|:---:|:---:|:---:|
| **Tempo Médio de Espera ($W_m$)** | 8,75 | 7,75 | **6,50** |
| **Tempo Médio de Turnaround ($TAT_m$)** | 15,25 | 14,25 | **13,00** |
| **Tempo Médio de Resposta ($RT_m$)** | 8,75 | 7,75 | **2,75** |
| **Trocas de Contexto** | 0 | 0 | 1 |

---

## 6. Estrutura do Projeto

```
src/main/
├── java/br/inatel/promethean/
│   ├── Main.java                        # Ponto de entrada (Servidor + Comparação)
│   ├── model/                           # Entidades de domínio (SpaceCraft, DockingPort, Workload)
│   ├── scheduler/                       # Estratégias de escalonamento (FCFS, SJF, Priority)
│   ├── simulation/                      # Motor de simulação discreta, eventos e métricas
│   ├── sync/                            # Primitivas (Locks, Semaphores, Barriers) e Cenários Concorrentes
│   ├── server/                          # Servidor Javalin (Rotas REST e canal WebSocket /ws/sync)
│   └── exceptions/                      # Exceções de domínio
└── resources/public/                    # Interface Web (HTML5, CSS3, ES Modules, SVG)
    ├── index.html                       # Cena 1: Escalonamento orbital e Gantt interativo
    ├── sincronismo.html                 # Cena 2: Disputa por braços e Grafo de Deadlock ao vivo
    ├── css/                             # Estilos espaciais (Dark theme)
    ├── js/                              # Lógica de renderização, player e WebSocket
    └── exemplos/                        # Gravações JSON pré-computadas de validação
```

---

## 7. Compilação e Execução

### Pré-requisitos
* **Java JDK 21+** instalado
* **Apache Maven 3.8+**

### Execução Local

```bash
# Clonar o repositório
git clone https://github.com/Felipe-Tagawa/Promethean.git
cd Promethean

# Compilar o projeto
mvn clean compile

# Executar a aplicação
mvn exec:java -Dexec.mainClass="br.inatel.promethean.Main"
```

Assim que a aplicação iniciar:
* O console exibirá a comparação estatística detalhada dos 3 algoritmos.
* Acesse no navegador:
  * **Escalonamento & Gantt:** `http://localhost:7070`
  * **Sincronismo & Deadlock:** `http://localhost:7070/sincronismo.html`

### Execução via Docker / Nuvem (Render)

O projeto suporta portas dinâmicas via variável de ambiente `PORT`:

```bash
# Build da imagem
docker build -t promethean .

# Execução do container
docker run -p 7070:7070 -e PORT=7070 promethean
```

> **Demonstração ao Vivo:** Acesse o simulador online em [promethean.onrender.com](https://promethean.onrender.com/)
