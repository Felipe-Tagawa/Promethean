// Origem dos dados: o servidor (contrato em docs/frontend/README.md) ou, sem ele, os arquivos de public/workloads,
// simulados pelo motor da própria tela (engine.js).

import {simulate} from './engine.js';

const DEMO_ALGORITHMS = [
    {key: 'fcfs', name: 'FCFS'},
    {key: 'sjf', name: 'Shortest Job First'},
    {key: 'sjf-preemptive', name: 'SJF Preemptivo'},
    {key: 'priority', name: 'Priority with Aging'},
];

/** Chave da carga sorteada pelo servidor; não existe arquivo para ela. */
export const RANDOM_KEY = 'aleatoria';

/** Carga usada quando nada foi escolhido: a de referência, N1 a N4. */
export const DEFAULT_WORKLOAD = 'referencia';

async function getJson(url) {
    const response = await fetch(url, {headers: {Accept: 'application/json'}});
    if (!response.ok) {
        // Erro de parâmetro vem como {"error": "..."} (contrato, seção 2)
        let detail = '';
        try {
            const body = await response.json();
            if (body?.error) detail = `: ${body.error}`;
        } catch {
            // resposta sem JSON: fica só o status
        }
        throw new Error(`${url} respondeu ${response.status}${detail}`);
    }
    return response.json();
}

// Os arquivos de carga não mudam enquanto a página está aberta: cada um é lido uma vez só
const workloadFiles = new Map();

function loadWorkloadFile(key) {
    if (!workloadFiles.has(key)) workloadFiles.set(key, getJson(`workloads/${encodeURIComponent(key)}.json`));
    return workloadFiles.get(key);
}

/** Sem servidor: monta a lista de cargas a partir do índice e dos arquivos, no mesmo formato da rota. */
async function demoWorkloads() {
    const keys = await getJson('workloads/index.json');
    const files = await Promise.all(keys.map(loadWorkloadFile));
    return files.map(w => ({
        key: w.key, title: w.title, universe: w.universe, description: w.description, ships: w.spacecrafts.length,
    }));
}

/**
 * Descobre se há servidor. Se a lista de algoritmos ou a de cargas não vier, cai no modo demonstração.
 * O parâmetro ?demo na URL força o modo demonstração.
 * @returns {mode, algorithms, workloads, random}; random diz se a carga aleatória está disponível
 */
export async function connect() {
    const forceDemo = new URLSearchParams(window.location.search).has('demo');
    if (!forceDemo) {
        try {
            const algorithms = await getJson('api/scheduling/algorithms');
            const workloads = await getJson('api/scheduling/workloads');
            if (Array.isArray(algorithms) && algorithms.length > 0 && Array.isArray(workloads) && workloads.length > 0) {
                return {mode: 'server', algorithms, workloads, random: true};
            }
        } catch {
            // Sem servidor ou sem os endpoints: segue para o modo demonstração
        }
    }
    // A tela não reproduz o sorteio do Java, então a carga aleatória só existe com o servidor
    return {mode: 'demo', algorithms: DEMO_ALGORITHMS, workloads: await demoWorkloads(), random: false};
}

/**
 * Busca a gravação de um algoritmo com a carga escolhida (seção 3.2 do contrato).
 * @param choice {key, seed, ships}; seed e ships só valem na carga aleatória
 */
export async function loadRecording(source, algorithm, choice) {
    if (source.mode === 'server') {
        const params = new URLSearchParams({algorithm: algorithm.key, workload: choice.key});
        if (choice.key === RANDOM_KEY) {
            params.set('seed', String(choice.seed));
            params.set('ships', String(choice.ships));
        }
        return getJson(`api/scheduling?${params}`);
    }

    if (choice.key === RANDOM_KEY) {
        throw new Error('A carga aleatória precisa do servidor.');
    }
    // Sem servidor, o motor da tela simula a carga do arquivo, com as mesmas regras do Java
    const file = await loadWorkloadFile(choice.key);
    const recording = simulate({algorithm: algorithm.key, name: algorithm.name, spacecrafts: file.spacecrafts, ports: ['P1']});
    return {...recording, workload: {key: file.key, title: file.title, universe: file.universe, seed: null}};
}
