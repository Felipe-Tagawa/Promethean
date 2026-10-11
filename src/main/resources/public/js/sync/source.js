// Origem dos eventos de sincronismo: o WebSocket do servidor (seção 4 do contrato) ou, sem ele, os arquivos de exemplo.

const DEMO_FILES = {
    'race|false': 'exemplos/sincronismo-corrida-desligado.json',
    'race|true': 'exemplos/sincronismo-corrida-ligado.json',
    'deadlock|false': 'exemplos/sincronismo-deadlock-desligado.json',
    'deadlock|true|none': 'exemplos/sincronismo-deadlock-travado.json',
    'deadlock|true|detection': 'exemplos/sincronismo-deadlock-recuperado.json',
    'deadlock|true|timeout': 'exemplos/sincronismo-deadlock-timeout.json',
};
const DEMO_TIME_SCALE = 1.4; // os exemplos são reproduzidos um pouco mais devagar que o gravado
const SOCKET_TIMEOUT_MS = 1500;

function query(config) {
    const params = new URLSearchParams({scenario: config.scenario, sync: String(config.sync), recovery: config.recovery});
    return params.toString();
}

/** Lê a mensagem de erro do contrato ({"error": "..."}), se houver. */
async function errorOf(response) {
    try {
        const body = await response.json();
        if (body && body.error) return String(body.error);
    } catch {
        // resposta sem JSON: usa o status
    }
    return `o servidor respondeu ${response.status}`;
}

function openSocket(url) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url);
        const timer = setTimeout(() => {
            socket.close();
            reject(new Error('tempo esgotado'));
        }, SOCKET_TIMEOUT_MS);
        socket.addEventListener('open', () => {
            clearTimeout(timer);
            resolve(socket);
        });
        socket.addEventListener('error', () => {
            clearTimeout(timer);
            reject(new Error('sem servidor'));
        });
    });
}

class ServerSource {

    constructor(socket, onEvent, onDisconnect) {
        this.mode = 'server';
        socket.addEventListener('message', message => {
            try {
                onEvent(JSON.parse(message.data));
            } catch {
                // mensagem que não é JSON: ignorada
            }
        });
        socket.addEventListener('close', onDisconnect);
    }

    async start(config) {
        const response = await fetch(`api/sync/start?${query(config)}`, {method: 'POST'});
        if (!response.ok) throw new Error(await errorOf(response));
    }

    async stop() {
        const response = await fetch('api/sync/stop', {method: 'POST'});
        if (!response.ok) throw new Error(await errorOf(response));
    }
}

class DemoSource {

    constructor(onEvent) {
        this.mode = 'demo';
        this.onEvent = onEvent;
        this.timers = [];
        this.lastTimeMs = 0;
    }

    async start(config) {
        this.cancel();
        const key = config.scenario === 'race' || !config.sync
            ? `${config.scenario}|${config.sync}`
            : `${config.scenario}|${config.sync}|${config.recovery}`;
        const file = DEMO_FILES[key];
        if (!file) throw new Error('não há arquivo de exemplo para esta combinação');

        const response = await fetch(file);
        if (!response.ok) throw new Error(`${file} respondeu ${response.status}`);
        const events = await response.json();

        this.timers = events.map(event => setTimeout(() => {
            this.lastTimeMs = event.timeMs;
            this.onEvent(event);
            if (event.type === 'SYNC_END') this.timers = [];
        }, event.timeMs * DEMO_TIME_SCALE));
    }

    /** Interrompe a reprodução e avisa a tela, como o servidor faria com SYNC_END. */
    async stop() {
        if (this.timers.length === 0) return;
        this.cancel();
        this.onEvent({timeMs: this.lastTimeMs + 100, type: 'SYNC_END', reason: 'STOPPED'});
    }

    cancel() {
        this.timers.forEach(clearTimeout);
        this.timers = [];
    }
}

/**
 * Tenta o WebSocket do servidor; se não abrir, usa os exemplos. O parâmetro ?demo na URL força os exemplos.
 * @param onEvent chamado com cada evento, na ordem
 * @param onDisconnect chamado se a conexão com o servidor cair
 */
export async function connectSync(onEvent, onDisconnect) {
    const forceDemo = new URLSearchParams(window.location.search).has('demo');
    if (!forceDemo) {
        try {
            const url = new URL('ws/sync', window.location.href);
            url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            url.search = '';
            return new ServerSource(await openSocket(url.href), onEvent, onDisconnect);
        } catch {
            // Sem servidor ou sem o WebSocket: segue para o modo demonstração
        }
    }
    return new DemoSource(onEvent);
}
