# Ingles em Contexto V1

Um agente open source para aprender ingles com menos decisao, mais fala e mais escuta real.

Ele usa series, dialogos e situacoes reais como contexto recorrente, mas o objetivo nao e "aprender ingles para assistir serie". O objetivo e **fluencia funcional**: viajar, conversar, entender audio, responder sem travar e usar ingles fora da tela.

## A ideia

A maioria dos metodos joga decisoes demais no aluno:

```text
O que estudar hoje?
Qual video assistir?
Quais palavras revisar?
Faço listening ou speaking?
Uso legenda ou nao?
```

Este agente faz o contrario:

```text
Todo dia o aluno abre o agente
e recebe exatamente a proxima acao de maior retorno,
sem precisar decidir nada.
```

Formato diario:

```text
Missao de hoje
Tempo:
Objetivo:

Hoje voce vai fazer:

Por que:

1.
2.
3.

Primeira acao:
```

O aluno entende o motivo da tarefa sem precisar ver a engenharia interna.

## Para quem e

- Quem quer ingles funcional geral.
- Quem trava porque nao sabe o que estudar no dia.
- Quem tem TDAH ou sofre com fadiga de decisao.
- Quem quer usar series como contexto, nao como objetivo final.
- Quem quer mais speaking, listening sem legenda e conversacao imprevisivel.

## O que o agente faz

- Cria a missao do dia automaticamente.
- Explica em uma frase curta por que aquela tarefa importa.
- Escolhe chunks de alto retorno para os proximos episodios.
- Exige producao oral cedo.
- Comeca sessoes com audio sem legenda quando ha audio disponivel.
- Cria conversas sem multipla escolha.
- Faz modo retorno quando o aluno some.
- Faz modo guerra de 3 minutos para dias ruins.
- Mostra progresso funcional sem fingir que um score e fluencia real.

## Comandos humanos

O aluno precisa lembrar de poucos comandos:

```text
começar
continuar
energia baixa
ver progresso
```

Tambem existem:

```text
voltei
modo guerra
```

## Diferenciais

### 1. Menos fadiga de decisao

O agente decide o que vem agora. O aluno executa.

### 2. Producao primeiro

Todo chunk novo precisa ser usado na mesma sessao.

```text
ver
ouvir
usar
```

### 3. Speaking agressivo

Um chunk importante pode exigir cinco respostas faladas antes de o aluno seguir.

### 4. Listening sem legenda

Quando existe audio, o fluxo comeca pelo ouvido:

```text
ouvir sem legenda
entender ideia geral
ouvir detalhes
shadowing curto
ver texto depois
```

### 5. Conversacao imprevisivel

O agente cria situacoes com surpresa, sem resposta pronta e sem multipla escolha.

### 6. Modo retorno

Se o aluno some, o agente nao mostra backlog gigante:

```text
Voce nao perdeu nada.
Vamos recuperar em 5 minutos.
```

## Como funciona por dentro

O projeto combina:

- memoria deterministica;
- analise de legendas;
- chunks recorrentes;
- revisao acionada por episodios futuros;
- pratica oral;
- transferencia para vida real;
- metricas de autonomia;
- estado local em JSON.

A arquitetura completa fica em [`docs/`](docs/).

## Estrutura

```text
ingles-em-contexto-opencode-v1-snowball/
├── README.md
├── install.sh
├── install.ps1
├── global-agent/
│   └── ingles-em-contexto.md
├── project-template/
│   ├── AGENTS.md
│   ├── MEMORY_RULES.md
│   ├── opencode.json
│   ├── .opencode/tools/
│   └── .ingles-em-contexto/
├── docs/
│   ├── METHOD.md
│   ├── OPENCODE_AGENT_GUIDE.md
│   ├── LLM_BEHAVIOR_GUIDE.md
│   ├── FILE_STRUCTURE.md
│   ├── UX_RULES.md
│   ├── ARCHITECTURE.md
│   ├── ACCELERATION_MODEL.md
│   ├── RESEARCH_BASIS.md
│   ├── SNOWBALL_ENGINE.md
│   └── INSTALLATION_NOTES.md
└── tests/
```

## Instalacao

Requisitos:

- [OpenCode](https://opencode.ai/)
- Node.js recente para rodar testes
- `ffmpeg` opcional para trabalhar com audio/video local

### macOS ou Linux

```bash
git clone https://github.com/wilsonferreira23/ingles-em-contexto.git
cd ingles-em-contexto
chmod +x install.sh
./install.sh
cd ~/ingles-em-contexto-estudos
opencode
```

### Windows PowerShell

```powershell
git clone https://github.com/wilsonferreira23/ingles-em-contexto.git
Set-Location ingles-em-contexto
.\install.ps1
Set-Location "$HOME\ingles-em-contexto-estudos"
opencode
```

Depois, no OpenCode, selecione o agente `ingles-em-contexto` e diga:

```text
começar
```

## Testes

```bash
node --test tests/*.test.mjs
node --check project-template/.opencode/tools/snowball_core.ts
node --check project-template/.opencode/tools/snowball_engine.ts
```

## Aviso honesto

Este projeto tenta reduzir desperdicio e aumentar aprendizagem por hora. Ele nao promete fluencia milagrosa nem garante "metade do tempo" sem dados reais do aluno.

A promessa do produto e mais concreta:

```text
abrir o agente
receber a proxima acao certa
entender por que ela importa
executar sem decidir o plano do dia
```

## Licenca

MIT. Use, adapte, teste e melhore.
