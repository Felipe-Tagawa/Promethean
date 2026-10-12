// Universos: cada um troca junto a estação, as naves, o fundo e o contexto das prioridades.
// É só aparência. Nenhum universo muda os dados da simulação nem o que o servidor envia.

const STORAGE_KEY = 'promethean.universo';
const URL_PARAM = 'universo';

/**
 * `hulls` e `priorities` estão em ordem de urgência: a posição 0 é a da nave mais urgente.
 * No escalonamento a nave usa o casco da posição da prioridade dela, para o desenho combinar com a situação;
 * no sincronismo não há prioridade, então vale a ordem das naves.
 *
 * `at` e `of` completam os subtítulos das páginas ("Escalonamento de CPU {at}").
 * `effect` é o efeito desenhado sobre a nave: damage (faíscas), infection (aura) ou leak (vazamento).
 */
export const UNIVERSES = [
    {
        key: 'padrao',
        name: 'Padrão',
        at: 'em uma estação orbital',
        of: '',
        hulls: ['classic'],
        priorities: [
            {label: 'Emergência a bordo', icon: 'alert'},
            {label: 'Feridos a bordo', icon: 'medical'},
            {label: 'Troca de tripulação', icon: 'crew'},
            {label: 'Carga de rotina', icon: 'crate'},
        ],
    },
    {
        key: 'starwars',
        name: 'Star Wars',
        at: 'na Estrela da Morte',
        of: 'da Estrela da Morte',
        hulls: ['falcon', 'xwing', 'destroyer', 'tie'],
        priorities: [
            {label: 'Danificada após ataque imperial', icon: 'damage', effect: 'damage'},
            {label: 'Feridos a bordo', icon: 'medical'},
            {label: 'Inspeção imperial', icon: 'shield'},
            {label: 'Patrulha de rotina', icon: 'patrol'},
        ],
    },
    {
        key: 'halo',
        name: 'Halo',
        at: 'em uma instalação Forerunner',
        of: 'da instalação Forerunner',
        hulls: ['frigate', 'pelican', 'covenant', 'promethean'],
        priorities: [
            {label: 'Infestação Flood a bordo', icon: 'biohazard', effect: 'infection'},
            {label: 'Feridos a bordo', icon: 'medical'},
            {label: 'Emissário do Covenant', icon: 'star'},
            {label: 'Patrulha Promethean', icon: 'patrol'},
        ],
    },
    {
        key: 'real',
        name: 'Real (ISS)',
        at: 'na Estação Espacial Internacional',
        of: 'da ISS',
        hulls: ['soyuz', 'dragon', 'shuttle', 'cargo'],
        priorities: [
            {label: 'Vazamento de oxigênio', icon: 'alert', effect: 'leak'},
            {label: 'Emergência médica', icon: 'medical'},
            {label: 'Troca de tripulação', icon: 'crew'},
            {label: 'Reabastecimento', icon: 'crate'},
        ],
    },
    {
        key: 'alien',
        name: 'Alien',
        at: 'na estação Sevastopol',
        of: 'da estação Sevastopol',
        hulls: ['nostromo', 'narcissus', 'sulaco', 'derelict'],
        priorities: [
            {label: 'Organismo alienígena a bordo', icon: 'biohazard', effect: 'infection', note: 'Ordem Especial 937: prioridade máxima'},
            {label: 'Tripulante ferido', icon: 'medical'},
            {label: 'Casco danificado', icon: 'damage', effect: 'damage'},
            {label: 'Sinal de origem desconhecida', icon: 'patrol'},
        ],
    },
    {
        key: 'destiny',
        name: 'Destiny',
        at: 'na Torre da Última Cidade',
        of: 'da Torre',
        hulls: ['jumpship', 'skiff', 'thresher', 'tombship'],
        priorities: [
            {label: 'Guardião sem Luz', icon: 'alert', note: 'Perdeu o Fantasma'},
            {label: 'Refugiados Eliksni a bordo', icon: 'crew'},
            {label: 'Engramas para o Criptarca', icon: 'engram'},
            {label: 'Patrulha de rotina', icon: 'patrol'},
        ],
    },
];

export function findUniverse(key) {
    return UNIVERSES.find(universe => universe.key === key) ?? UNIVERSES[0];
}

/** Casco da nave que ocupa a posição dada (prioridade no escalonamento, ordem no sincronismo). */
export function hullFor(universe, position) {
    return universe.hulls[position % universe.hulls.length];
}

/** Situação que o universo dá a um nível de prioridade; 0 é o mais urgente. */
export function priorityContext(universe, rank) {
    return universe.priorities[Math.min(rank, universe.priorities.length - 1)];
}

function readStorage() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null; // navegador sem armazenamento local: o universo só não é lembrado
    }
}

function writeStorage(key) {
    try {
        localStorage.setItem(STORAGE_KEY, key);
    } catch {
        // idem
    }
}

/** O universo em uso: o da URL (?universo=chave) vale mais que o lembrado pelo navegador. */
export function currentUniverse() {
    const fromUrl = new URLSearchParams(location.search).get(URL_PARAM);
    return findUniverse(fromUrl ?? readStorage());
}

/** Aplica o universo à página: as cores (css/universe.css) e os subtítulos marcados com data-universe-text. */
function applyToPage(universe) {
    document.documentElement.dataset.universe = universe.key;
    for (const node of document.querySelectorAll('[data-universe-text]')) {
        node.textContent = node.dataset.universeText
            .replace('{at}', universe.at)
            .replace('{of}', universe.of)
            .trim();
    }
}

/**
 * Liga o seletor de universo da barra de cima.
 * @param select o <select> da página
 * @param onChange chamado com o universo escolhido a cada troca
 * @returns o universo em uso ao abrir a página
 */
export function bindUniverseSelect(select, onChange) {
    const initial = currentUniverse();
    for (const universe of UNIVERSES) select.add(new Option(universe.name, universe.key));
    select.value = initial.key;
    writeStorage(initial.key); // um universo vindo da URL passa a valer também na outra página
    applyToPage(initial);

    select.addEventListener('change', () => {
        const universe = findUniverse(select.value);
        writeStorage(universe.key);

        // Se a URL fixava um universo, ela acompanha a troca; senão ele voltaria ao recarregar
        const url = new URL(location.href);
        if (url.searchParams.has(URL_PARAM)) {
            url.searchParams.set(URL_PARAM, universe.key);
            history.replaceState(null, '', url);
        }

        applyToPage(universe);
        onChange(universe);
    });
    return initial;
}
