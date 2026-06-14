# FluentPilot

Pare de decidir o que estudar. Abra o agente e faça a próxima missão.

**FluentPilot** é um agente para OpenCode e Hermes que transforma séries, diálogos e situações reais em missões diárias de inglês funcional. Ele foi feito para quem quer evoluir sem perder energia escolhendo vídeo, palavra, revisão, legenda, speaking, listening ou plano do dia.

```text
Você abre o agente.
Ele decide a próxima ação de maior retorno.
Você executa.
```

## O problema

Conteúdo de inglês não falta.

O que trava muita gente é isto:

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

No Hermes, ele também pode agir pelo WhatsApp com cron jobs:

- mandar a missão do dia;
- perguntar energia;
- chamar Modo Retorno se você sumir;
- antecipar revisão antes de reaparecer no conteúdo;
- cobrar teste cego mensal;
- resumir a semana.

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

E também treina pragmática: interrupções, mal-entendidos, mudança brusca de assunto, defesa rápida de uma escolha e reação natural a humor ou ironia leve. A meta é o aluno não congelar quando a conversa real sair do roteiro.

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

FluentPilot é um agente para **OpenCode** e **Hermes**, com lógica local e estado em arquivos. Ele não depende de uma plataforma fechada nem de banco de dados externo.

Por dentro, o projeto usa:

- **OpenCode agents**: o comportamento principal fica em `global-agent/fluentpilot.md`.
- **TypeScript tools**: funções determinísticas em `.opencode/tools/`.
- **Hermes profile**: distribuição em `hermes/` com `SOUL.md`, `AGENTS.md`, skill e plugin Python.
- **Hermes plugin**: ferramentas determinísticas em `hermes/plugins/fluentpilot/`.
- **Hermes cron**: nudges automáticos via gateway, incluindo WhatsApp.
- **Node.js test runner**: testes com `node --test`, sem framework pesado.
- **JSON local**: progresso, missões, revisão e métricas ficam em `.ingles-em-contexto/`.
- **ffmpeg opcional**: extração de pequenos trechos de áudio quando o usuário fornece mídia local.
- **Arquitetura separada**: prompt do agente, regras de runtime, docs e tools ficam em arquivos diferentes.

Principais módulos:

```text
fluentpilot_health.ts diagnóstico de instalação/tools
fluentpilot_runtime.ts helpers de runtime e compatibilidade
study_memory.ts      memória pedagógica
learning_engine.ts   cobertura, revisão e sessões
snowball_core.ts     funções puras testáveis
snowball_engine.ts   tools OpenCode + persistência
media_clips.ts       áudio local opcional
hermes/plugins/      plugin Python para Hermes
hermes/cron/         templates de nudges automáticos
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
- não usa OpenCode nem Hermes.

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

Requisitos para OpenCode:

- [OpenCode](https://opencode.ai/)
- Node.js recente para rodar testes
- `ffmpeg` opcional para áudio/vídeo local

### OpenCode no macOS ou Linux

```bash
git clone https://github.com/wilsonferreira23/fluentpilot.git
cd fluentpilot
chmod +x install.sh
./install.sh
cd ~/fluentpilot-estudos
opencode
```

Você pode rodar `./install.sh` novamente para atualizar agente e tools sem apagar seu progresso, suas legendas ou a pasta `.ingles-em-contexto`.

### OpenCode no Windows PowerShell

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

Para confirmar que os tools carregaram, diga:

```text
diagnostico
```

Se o agente responder que `study_memory_*`, `learning_engine_*` ou `snowball_engine_*` não existem, quase sempre é uma destas causas:

1. você abriu o OpenCode fora da pasta `~/fluentpilot-estudos`;
2. instalou o prompt global, mas não reiniciou o OpenCode;
3. está usando uma instalação antiga, antes dos tools globais;
4. no macOS, o app Accomplish/OpenCode está usando `~/Library/Application Support/Accomplish/opencode` como diretório de configuração.

Correção rápida:

```bash
cd fluentpilot
./install.sh
cd ~/fluentpilot-estudos
opencode
```

Depois de atualizar, feche e abra novamente o OpenCode/Accomplish.

O instalador copia:

- o agente para `~/.config/opencode/agents/fluentpilot.md`;
- os tools para `~/.config/opencode/tools/`;
- no macOS, se existir, também copia agente e tools para `~/Library/Application Support/Accomplish/opencode/`;
- o projeto de estudo para `~/fluentpilot-estudos`.

### Hermes

Requisitos:

- [Hermes](https://hermes-agent.nousresearch.com/docs/getting-started/installation/)
- Python local disponível para o plugin Hermes
- Node.js recente para rodar os testes do projeto
- `ffmpeg` opcional para áudio/vídeo local

Instalação:

```bash
git clone https://github.com/wilsonferreira23/fluentpilot.git
cd fluentpilot
chmod +x install-hermes.sh
./install-hermes.sh
cd ~/fluentpilot-estudos
fluentpilot chat
```

Se o alias `fluentpilot` ainda não existir:

```bash
hermes profile create fluentpilot
fluentpilot plugins enable fluentpilot
hermes profile use fluentpilot
hermes chat
```

Depois diga:

```text
diagnostico
```

O instalador Hermes copia:

- `hermes/SOUL.md` para o profile `fluentpilot`;
- `hermes/AGENTS.md` e `hermes/config.yaml`;
- os cron templates `hermes/cron/*.json`;
- o skill `hermes/skills/fluentpilot/SKILL.md`;
- o plugin Python `hermes/plugins/fluentpilot/`;
- o projeto de estudo para `~/fluentpilot-estudos`.

Para instalar nudges automáticos no WhatsApp:

```bash
FLUENTPILOT_INSTALL_CRON=1 FLUENTPILOT_CRON_DELIVER=whatsapp ./install-hermes.sh
hermes gateway start
```

Guia completo: [`docs/HERMES_INSTALLATION.md`](docs/HERMES_INSTALLATION.md).

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
- modos para baixa energia e retorno;
- cron jobs Hermes para WhatsApp.

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
node --check project-template/.opencode/tools/fluentpilot_health.ts
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
