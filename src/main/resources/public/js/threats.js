// Ameaças: imprevistos que atingem as naves ou a estação durante o escalonamento.
// Cada universo tem a sua lista. "Nenhuma" é o padrão e não muda nada: a tela reproduz a gravação do servidor.
// Com uma ameaça ativa, quem recalcula a simulação é o motor da tela (engine.js), e não o servidor.
//
// Cada ação tem:
//   tick     quando acontece; se não houver alvo nesse tick, espera o primeiro tick em que houver
//   every    opcional: repete a cada tantos ticks, cada vez em uma nave ainda não atingida
//   target   quem é atingido, sempre entre as naves que estão na órbita ou atracadas:
//            'leastUrgent', 'mostUrgent', 'longestBurst', 'running', 'firstReady', 'allReady' ou {rank: n}
//            (n é o nível de urgência na carga; 0 é a mais urgente). Ações de porta não têm alvo
//   effects  o que acontece, com o conceito de SO correspondente:
//            {kind: 'priority'}          a nave passa na frente de todas (mudança de prioridade em execução)
//            {kind: 'burst', amount}     a nave precisa de mais tempo de porta (o processo pede mais CPU)
//            {kind: 'destroy', style}    a nave sai sem terminar (processo encerrado à força)
//            {kind: 'destroy', revive}   idem, mas a nave volta à órbita depois de `revive` ticks e recomeça do zero
//                                        (processo reiniciado por um supervisor); a frase da volta fica em reviveText
//            {kind: 'port', ticks}       a porta fica interditada (núcleo de CPU fora de serviço)
//   text     frase do registro de eventos; {nave} e {porta} são trocados pelos nomes
//
// `visual` diz à cena como desenhar a ameaça (threatfx.js).

const THREATS = {

    padrao: [
        {
            key: 'asteroides',
            name: 'Chuva de asteroides',
            summary: 'A nave menos urgente é atingida e passa na frente de todas.',
            visual: {kind: 'shower', color: '#b9a48a'},
            actions: [{
                tick: 4, target: 'leastUrgent', effects: [{kind: 'priority'}],
                text: '{nave} foi atingida pelos asteroides e virou prioridade máxima',
            }],
        },
        {
            key: 'tempestade',
            name: 'Tempestade solar',
            summary: 'A porta fica interditada por 4 ticks.',
            visual: {kind: 'storm', color: '#ffb454'},
            actions: [{
                tick: 6, effects: [{kind: 'port', ticks: 4}],
                text: 'Tempestade solar: a porta {porta} fica interditada por 4 ticks',
            }],
        },
        {
            key: 'pane',
            name: 'Pane no motor',
            summary: 'A nave de maior burst precisa de mais 4 ticks de porta.',
            visual: {kind: 'alarm', color: '#ffd866'},
            actions: [{
                tick: 5, target: 'longestBurst', effects: [{kind: 'burst', amount: 4}],
                text: '{nave} teve uma pane no motor e precisa de mais 4 ticks de porta',
            }],
        },
        {
            key: 'colisao',
            name: 'Colisão',
            summary: 'Uma nave é destruída por um asteroide.',
            visual: {kind: 'shower', color: '#b9a48a'},
            actions: [{
                tick: 6, target: {rank: 1}, effects: [{kind: 'destroy'}],
                text: '{nave} colidiu com um asteroide e foi destruída',
            }],
        },
    ],

    starwars: [
        {
            key: 'ataque-rebelde',
            name: 'Ataque rebelde',
            summary: 'Um caça rebelde atira no Star Destroyer, que vira prioridade máxima e precisa de 2 ticks de reparo.',
            visual: {kind: 'flyby', hull: 'xwing', color: '#ff5a4a'},
            actions: [{
                tick: 5, target: {rank: 2}, effects: [{kind: 'priority'}, {kind: 'burst', amount: 2}],
                text: 'Um caça rebelde atirou em {nave}: prioridade máxima e mais 2 ticks de reparo',
            }],
        },
        {
            key: 'torpedo',
            name: 'Torpedo de prótons',
            summary: 'O caça TIE é destruído.',
            visual: {kind: 'flyby', hull: 'xwing', color: '#ff8fd0'},
            actions: [{
                tick: 7, target: {rank: 3}, effects: [{kind: 'destroy'}],
                text: '{nave} foi destruída por um torpedo de prótons',
            }],
        },
        {
            key: 'raio-trator',
            name: 'Sabotagem do raio trator',
            summary: 'A porta fica interditada por 3 ticks.',
            visual: {kind: 'lockdown', color: '#9fdcff'},
            actions: [{
                tick: 3, effects: [{kind: 'port', ticks: 3}],
                text: 'Raio trator sabotado: a porta {porta} fica interditada por 3 ticks',
            }],
        },
    ],

    halo: [
        {
            key: 'flood',
            name: 'Flood se espalha',
            summary: 'A cada 4 ticks a infecção chega à primeira nave da órbita, que vira prioridade máxima.',
            visual: {kind: 'spread', color: '#9dff8a'},
            actions: [{
                tick: 4, every: 4, target: 'firstReady', effects: [{kind: 'priority'}],
                text: 'O Flood chegou a {nave}, que virou prioridade máxima',
            }],
        },
        {
            key: 'vitrificacao',
            name: 'Raio de vitrificação',
            summary: 'O Covenant destrói a nave que estiver atracada.',
            visual: {kind: 'beam', color: '#c79bff'},
            actions: [{
                tick: 6, target: 'running', effects: [{kind: 'destroy'}],
                text: 'O raio do Covenant destruiu {nave} na porta',
            }],
        },
        {
            key: 'pulso',
            name: 'Pulso do anel',
            summary: 'A porta fica interditada por 3 ticks e cada nave na órbita precisa de mais 1 tick.',
            visual: {kind: 'storm', color: '#5fe3c0'},
            actions: [
                {
                    tick: 5, effects: [{kind: 'port', ticks: 3}],
                    text: 'Pulso do anel: a porta {porta} fica interditada por 3 ticks',
                },
                {
                    tick: 5, target: 'allReady', effects: [{kind: 'burst', amount: 1}],
                    text: '{nave} foi atingida pelo pulso e precisa de mais 1 tick de porta',
                },
            ],
        },
    ],

    real: [
        {
            key: 'detritos',
            name: 'Detritos espaciais',
            summary: 'A nave atracada é atingida e precisa de mais 3 ticks de reparo.',
            visual: {kind: 'shower', color: '#c9d2e6'},
            actions: [{
                tick: 4, target: 'running', effects: [{kind: 'burst', amount: 3}],
                text: '{nave} foi atingida por detritos e precisa de mais 3 ticks de reparo',
            }],
        },
        {
            key: 'tempestade-solar',
            name: 'Tempestade solar',
            summary: 'A porta fica interditada por 5 ticks.',
            visual: {kind: 'storm', color: '#ffb454'},
            actions: [{
                tick: 5, effects: [{kind: 'port', ticks: 5}],
                text: 'Tempestade solar: a porta {porta} fica interditada por 5 ticks',
            }],
        },
        {
            key: 'missao-abortada',
            name: 'Missão abortada',
            summary: 'A nave menos urgente desiste e volta para a Terra.',
            visual: {kind: 'alarm', color: '#8ec5ff'},
            actions: [{
                tick: 6, target: 'leastUrgent', effects: [{kind: 'destroy', style: 'abort'}],
                text: '{nave} abortou a missão e voltou para a Terra',
            }],
        },
    ],

    alien: [
        {
            key: 'organismo',
            name: 'Organismo à solta',
            summary: 'A nave atracada entra em quarentena e precisa de mais 5 ticks.',
            visual: {kind: 'alarm', color: '#9dff8a'},
            actions: [{
                tick: 7, target: 'running', effects: [{kind: 'burst', amount: 5}],
                text: 'O organismo escapou em {nave}: quarentena de mais 5 ticks',
            }],
        },
        {
            key: 'autodestruicao',
            name: 'Autodestruição',
            summary: 'A nave mais urgente explode.',
            visual: {kind: 'alarm', color: '#ff7a90'},
            actions: [{
                tick: 3, target: 'mostUrgent', effects: [{kind: 'destroy'}],
                text: 'A autodestruição de {nave} foi acionada',
            }],
        },
        {
            key: 'quarentena',
            name: 'Quarentena da estação',
            summary: 'A porta fica interditada por 4 ticks.',
            visual: {kind: 'lockdown', color: '#e0b83a'},
            actions: [{
                tick: 4, effects: [{kind: 'port', ticks: 4}],
                text: 'Quarentena: a porta {porta} fica interditada por 4 ticks',
            }],
        },
    ],

    destiny: [
        {
            key: 'emboscada-cabal',
            name: 'Emboscada Cabal',
            summary: 'Um Debulhador destrói a nave do Guardião; o Fantasma a revive 4 ticks depois e ela recomeça do zero.',
            visual: {kind: 'flyby', hull: 'thresher', color: '#ff8a4a'},
            actions: [{
                tick: 3, target: {rank: 0}, effects: [{kind: 'destroy', revive: 4}],
                text: 'Um Debulhador Cabal destruiu {nave}',
                reviveText: 'O Fantasma reviveu {nave}: ela volta à órbita e recomeça do zero',
            }],
        },
        {
            key: 'frota-negra',
            name: 'Chegada da Frota Negra',
            summary: 'Uma Pirâmide encobre a Torre e a porta fica interditada por 4 ticks.',
            visual: {kind: 'pyramid', color: '#9aa0b8'},
            actions: [{
                tick: 5, effects: [{kind: 'port', ticks: 4}],
                text: 'Uma Pirâmide encobriu a Torre: a porta {porta} fica interditada por 4 ticks',
            }],
        },
        {
            key: 'laco-vex',
            name: 'Laço temporal Vex',
            summary: 'A nave atracada fica presa em um laço temporal e precisa de mais 4 ticks.',
            visual: {kind: 'alarm', color: '#ffb454'},
            actions: [{
                tick: 6, target: 'running', effects: [{kind: 'burst', amount: 4}],
                text: '{nave} ficou presa em um laço temporal Vex e precisa de mais 4 ticks',
            }],
        },
        {
            key: 'possuida',
            name: 'Possuída por Oryx',
            summary: 'A nave menos urgente é levada pelos Possuídos e não volta.',
            visual: {kind: 'alarm', color: '#d5dcff'},
            actions: [{
                tick: 7, target: 'leastUrgent', effects: [{kind: 'destroy', style: 'taken'}],
                text: '{nave} foi possuída por Oryx e deixou a órbita',
            }],
        },
    ],
};

/** Ameaças disponíveis em um universo. */
export function threatsOf(universeKey) {
    return THREATS[universeKey] ?? [];
}

export function findThreat(universeKey, threatKey) {
    return threatsOf(universeKey).find(threat => threat.key === threatKey) ?? null;
}
