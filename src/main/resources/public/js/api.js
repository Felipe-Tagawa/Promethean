// Origem dos dados: o servidor (contrato em docs/frontend/README.md) ou, sem ele, os arquivos de exemplo.

const DEMO_ALGORITHMS = [
    {key: 'fcfs', name: 'FCFS', file: 'exemplos/escalonamento-fcfs.json'},
    {key: 'sjf', name: 'Shortest Job First', file: 'exemplos/escalonamento-sjf.json'},
    {key: 'priority', name: 'Priority with Aging', file: 'exemplos/escalonamento-priority.json'},
];

async function getJson(url) {
    const response = await fetch(url, {headers: {Accept: 'application/json'}});
    if (!response.ok) {
        throw new Error(`${url} respondeu ${response.status}`);
    }
    return response.json();
}

/**
 * Descobre se há servidor. Se a lista de algoritmos não vier, cai no modo demonstração.
 * O parâmetro ?demo na URL força o modo demonstração.
 */
export async function connect() {
    const forceDemo = new URLSearchParams(window.location.search).has('demo');
    if (!forceDemo) {
        try {
            const algorithms = await getJson('api/scheduling/algorithms');
            if (Array.isArray(algorithms) && algorithms.length > 0) {
                return {mode: 'server', algorithms};
            }
        } catch {
            // Sem servidor ou sem o endpoint: segue para o modo demonstração
        }
    }
    return {mode: 'demo', algorithms: DEMO_ALGORITHMS};
}

/** Busca a gravação de um algoritmo (seção 3.2 do contrato). */
export function loadRecording(source, algorithm) {
    if (source.mode === 'server') {
        return getJson(`api/scheduling?algorithm=${encodeURIComponent(algorithm.key)}`);
    }
    return getJson(algorithm.file);
}
