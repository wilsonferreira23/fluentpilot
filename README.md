# FluentPilot

Pare de decidir o que estudar. Abra o agente e faça a próxima missão.

**FluentPilot** é um agente para OpenCode que transforma séries, diálogos e situações reais em missões diárias de inglês funcional. Ele foi feito para quem quer evoluir sem perder energia escolhendo vídeo, palavra, revisão, legenda, speaking, listening ou plano do dia.

```text
Você abre o agente.
Ele decide a próxima ação de maior retorno.
Você executa.
```

## O problema

Conteúdo de inglês não falta.

O que trava muita gente e isto:

```text
O que eu estudo hoje?
Qual video eu uso?
Reviso ou aprendo coisa nova?
Treino listening ou speaking?
Uso legenda ou tiro legenda?
Como sei se estou melhorando?
```

Essa decisão diária mata consistência, especialmente para quem tem TDAH ou pouca energia mental no fim do dia.

## A solução

Um agente que cuida do plano por você.

Todo dia ele responde:

```text
Missão de hoje
Tempo: 12 minutos
Objetivo: viagem

Hoje você vai fazer:
5 respostas faladas usando "Could you help me?"

Por quê:
Essa expressão ajuda você a pedir ajuda em hotel, aeroporto e restaurante sem travar.

1. Ouvir
2. Repetir
3. Usar em voz alta

Primeira ação:
Fale: "Could you help me find my hotel?"
```

Curto. Claro. Sem você decidir o plano.

## O diferencial

A maioria dos agentes de estudo responde perguntas.

Este agente **dirige a próxima ação**.

Ele não quer que você vire especialista em método. Ele quer que você faça a tarefa certa hoje:

- uma expressão de alto retorno;
- uma revisão que vai aparecer de novo;
- uma resposta falada;
- um trecho ouvido sem legenda;
- uma conversa curta sem múltipla escolha;
- uma tarefa transferida para vida real.

## O que ele treina

### Speaking desde cedo

Todo chunk importante precisa sair da boca.

```text
ver
ouvir
usar
```

Sem acumular centenas de frases passivas que você reconhece mas não consegue falar.

### Listening sem legenda

Quando existe áudio, o ouvido vem antes do texto:

```text
ouvir sem legenda
pegar a ideia geral
ouvir detalhes
fazer shadowing curto
ver o texto depois
```

### Conversação imprevisível

Nada de depender só de múltipla escolha.

O agente cria pequenas situações com surpresa:

```text
O hotel não achou sua reserva.
Responda usando "I need to..."
Agora peça clarificação.
Agora encerre educadamente.
```

### Retorno sem culpa

Sumiu por 10 dias?

O agente não joga um backlog gigante na sua cara.

```text
Você não perdeu nada.
Vamos recuperar em 5 minutos.
```

### Modo guerra

Sem energia?

```text
Fale 30 segundos.
Acabou.
```

Melhor uma missão pequena feita do que uma aula perfeita ignorada.

## Por que séries entram no método?

Não é para aprender inglês "para assistir série".

Séries e diálogos funcionam como um laboratório recorrente:

- personagens repetem vozes e situações;
- chunks reaparecem;
- vocabulário volta em contexto;
- o aluno encontra a mesma expressão naturalmente;
- próximos episódios ficam mais fáceis.

A prova final não é entender uma cena. A prova é usar inglês fora dela.

## Tecnologia

FluentPilot é um agente para **OpenCode**, com lógica local e estado em arquivos. Ele não depende de uma plataforma fechada nem de banco de dados externo.

Por dentro, o projeto usa:

- **OpenCode agents**: o comportamento principal fica em `global-agent/fluentpilot.md`.
- **TypeScript tools**: funções determinísticas em `.opencode/tools/`.
- **Node.js test runner**: testes com `node --test`, sem framework pesado.
- **JSON local**: progresso, missões, revisão e métricas ficam em `.ingles-em-contexto/`.
- **ffmpeg opcional**: extração de pequenos trechos de áudio quando o usuário fornece mídia local.
- **Arquitetura separada**: prompt do agente, regras de runtime, docs e tools ficam em arquivos diferentes.

Principais módulos:

```text
study_memory.ts      memória pedagógica
learning_engine.ts   cobertura, revisão e sessões
snowball_core.ts     funções puras testáveis
snowball_engine.ts   tools OpenCode + persistência
media_clips.ts       áudio local opcional
```

Isso permite testar a lógica do método sem depender da resposta criativa de uma LLM.

## Base do método

FluentPilot é **research-informed**, não uma promessa mágica de fluência.

Ele combina ideias bem documentadas em aquisição de segunda língua:

- **Cobertura lexical em vídeo**: compreender conteúdo audiovisual melhora conforme aumenta a proporção de palavras conhecidas. Isso inspira o uso de cobertura como gate para decidir quando um episódio deve ser profundo, extensivo ou autônomo.  
  Fonte: [Lexical coverage in L1 and L2 viewing comprehension](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/lexical-coverage-in-l1-and-l2-viewing-comprehension/DFCA6605076705D5762C98F286D16B27).

- **Aprendizagem incidental com TV**: assistir conteúdo em L2 pode gerar aprendizagem incidental de vocabulário, influenciada por frequência, conhecimento prévio e cognatos. Isso inspira o uso de séries como laboratório recorrente, não como fim do método.  
  Fonte: [Incidental vocabulary acquisition through viewing L2 television](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/incidental-vocabulary-acquisition-through-viewing-l2-television-and-factors-that-affect-learning/0E45A630F37C48A5BDB6CC3F725ADDC9).

- **Sequências formulaicas e chunks**: aprendizes se beneficiam de repertórios de expressões multiword, especialmente padrões reutilizáveis. Isso inspira a abordagem chunk-first.  
  Fonte: [Experimental and intervention studies on formulaic sequences in a second language](https://www.cambridge.org/core/journals/annual-review-of-applied-linguistics/article/experimental-and-intervention-studies-on-formulaic-sequences-in-a-second-language/A2ACDF54604CFAC4443240748360C403).

- **Prática distribuída e fluência**: repetição ajuda, mas o formato e a distribuição da prática importam para transferência e fluência. Isso inspira missões curtas, revisões futuras e uso em contextos diferentes.  
  Fonte: [The effects of distributed practice on second language fluency development](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/effects-of-distributed-practice-on-second-language-fluency-development/4F6787916C198376CAD222934D3B37E4).

Tradução prática:

```text
menos lista de palavras
mais chunks úteis
mais encontros naturais
mais fala
mais escuta sem legenda
mais transferência para vida real
```

## Para quem é

Este projeto faz sentido se você:

- quer inglês funcional geral;
- trava porque não sabe o que estudar;
- quer uma rotina guiada por agente;
- gosta de aprender com contexto real;
- quer falar mais, não só consumir conteúdo;
- quer reduzir dependência de legenda;
- precisa de missões pequenas e claras.

Talvez não seja para você se:

- quer uma apostila tradicional;
- quer estudar gramática em ordem escolar;
- quer só flashcards;
- não usa OpenCode.

## Comandos principais

O aluno precisa lembrar de poucos comandos:

```text
começar
continuar
energia baixa
ver progresso
```

Também existem:

```text
voltei
modo guerra
```

## Instalação

Requisitos:

- [OpenCode](https://opencode.ai/)
- Node.js recente para rodar testes
- `ffmpeg` opcional para áudio/vídeo local

### macOS ou Linux

```bash
git clone https://github.com/wilsonferreira23/fluentpilot.git
cd fluentpilot
chmod +x install.sh
./install.sh
cd ~/fluentpilot-estudos
opencode
```

### Windows PowerShell

```powershell
git clone https://github.com/wilsonferreira23/fluentpilot.git
Set-Location fluentpilot
.\install.ps1
Set-Location "$HOME\fluentpilot-estudos"
opencode
```

Depois, no OpenCode, selecione o agente `fluentpilot` e diga:

```text
começar
```

## Como funciona por dentro

O agente combina:

- memória local em JSON;
- análise de legendas;
- seleção de chunks recorrentes;
- revisão acionada por episódios futuros;
- speaking obrigatório;
- listening sem legenda;
- transferência para vida real;
- score funcional não literal;
- modos para baixa energia e retorno.

Arquitetura e notas técnicas ficam em [`docs/`](docs/).

## Estrutura

```text
fluentpilot/
├── README.md
├── install.sh
├── install.ps1
├── global-agent/
│   └── fluentpilot.md
├── project-template/
│   ├── AGENTS.md
│   ├── MEMORY_RULES.md
│   ├── opencode.json
│   ├── .opencode/tools/
│   └── .ingles-em-contexto/
├── docs/
└── tests/
```

## Testes

```bash
node --test tests/*.test.mjs
node --check project-template/.opencode/tools/snowball_core.ts
node --check project-template/.opencode/tools/snowball_engine.ts
```

## Aviso honesto

Este projeto não promete fluência milagrosa.

Ele promete algo mais concreto:

```text
menos decisão
mais execução
mais fala
mais escuta real
mais continuidade
```

Se isso fizer você estudar com mais constância, o método já venceu a parte mais difícil.

## Contribuindo

Ideias, issues e melhorias são bem-vindas.

Boas contribuições:

- melhorar UX do agente;
- criar novos drills de speaking;
- melhorar roteamento de tools;
- adicionar testes de consistencia;
- melhorar instalação;
- testar com modelos diferentes.

## Licença

MIT. Use, adapte, teste e melhore.
