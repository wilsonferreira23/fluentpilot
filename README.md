# Ingles em Contexto

Pare de decidir o que estudar. Abra o agente e faca a proxima missao.

**Ingles em Contexto** e um agente para OpenCode que transforma series, dialogos e situacoes reais em missoes diarias de ingles funcional. Ele foi feito para quem quer evoluir sem perder energia escolhendo video, palavra, revisao, legenda, speaking, listening ou plano do dia.

```text
Voce abre o agente.
Ele decide a proxima acao de maior retorno.
Voce executa.
```

## O problema

Conteudo de ingles nao falta.

O que trava muita gente e isto:

```text
O que eu estudo hoje?
Qual video eu uso?
Reviso ou aprendo coisa nova?
Treino listening ou speaking?
Uso legenda ou tiro legenda?
Como sei se estou melhorando?
```

Essa decisao diaria mata consistencia, especialmente para quem tem TDAH ou pouca energia mental no fim do dia.

## A solucao

Um agente que cuida do plano por voce.

Todo dia ele responde:

```text
Missao de hoje
Tempo: 12 minutos
Objetivo: viagem

Hoje voce vai fazer:
5 respostas faladas usando "Could you help me?"

Por que:
Essa expressao ajuda voce a pedir ajuda em hotel, aeroporto e restaurante sem travar.

1. Ouvir
2. Repetir
3. Usar em voz alta

Primeira acao:
Fale: "Could you help me find my hotel?"
```

Curto. Claro. Sem voce decidir o plano.

## O diferencial

A maioria dos agentes de estudo responde perguntas.

Este agente **dirige a proxima acao**.

Ele nao quer que voce vire especialista em metodo. Ele quer que voce faca a tarefa certa hoje:

- uma expressao de alto retorno;
- uma revisao que vai aparecer de novo;
- uma resposta falada;
- um trecho ouvido sem legenda;
- uma conversa curta sem multipla escolha;
- uma tarefa transferida para vida real.

## O que ele treina

### Speaking desde cedo

Todo chunk importante precisa sair da boca.

```text
ver
ouvir
usar
```

Sem acumular centenas de frases passivas que voce reconhece mas nao consegue falar.

### Listening sem legenda

Quando existe audio, o ouvido vem antes do texto:

```text
ouvir sem legenda
pegar a ideia geral
ouvir detalhes
fazer shadowing curto
ver o texto depois
```

### Conversacao imprevisivel

Nada de depender so de multipla escolha.

O agente cria pequenas situacoes com surpresa:

```text
O hotel nao achou sua reserva.
Responda usando "I need to..."
Agora peca clarificacao.
Agora encerre educadamente.
```

### Retorno sem culpa

Sumiu por 10 dias?

O agente nao joga um backlog gigante na sua cara.

```text
Voce nao perdeu nada.
Vamos recuperar em 5 minutos.
```

### Modo guerra

Sem energia?

```text
Fale 30 segundos.
Acabou.
```

Melhor uma missao pequena feita do que uma aula perfeita ignorada.

## Por que series entram no metodo?

Nao e para aprender ingles "para assistir serie".

Series e dialogos funcionam como um laboratorio recorrente:

- personagens repetem vozes e situacoes;
- chunks reaparecem;
- vocabulario volta em contexto;
- o aluno encontra a mesma expressao naturalmente;
- proximos episodios ficam mais faceis.

A prova final nao e entender uma cena. A prova e usar ingles fora dela.

## Para quem e

Este projeto faz sentido se voce:

- quer ingles funcional geral;
- trava porque nao sabe o que estudar;
- quer uma rotina guiada por agente;
- gosta de aprender com contexto real;
- quer falar mais, nao so consumir conteudo;
- quer reduzir dependencia de legenda;
- precisa de missoes pequenas e claras.

Talvez nao seja para voce se:

- quer uma apostila tradicional;
- quer estudar gramatica em ordem escolar;
- quer so flashcards;
- nao usa OpenCode.

## Comandos principais

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

## Instalacao

Requisitos:

- [OpenCode](https://opencode.ai/)
- Node.js recente para rodar testes
- `ffmpeg` opcional para audio/video local

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

## Como funciona por dentro

O agente combina:

- memoria local em JSON;
- analise de legendas;
- selecao de chunks recorrentes;
- revisao acionada por episodios futuros;
- speaking obrigatorio;
- listening sem legenda;
- transferencia para vida real;
- score funcional nao literal;
- modos para baixa energia e retorno.

Arquitetura e notas tecnicas ficam em [`docs/`](docs/).

## Estrutura

```text
ingles-em-contexto/
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
└── tests/
```

## Testes

```bash
node --test tests/*.test.mjs
node --check project-template/.opencode/tools/snowball_core.ts
node --check project-template/.opencode/tools/snowball_engine.ts
```

## Aviso honesto

Este projeto nao promete fluencia milagrosa.

Ele promete algo mais concreto:

```text
menos decisao
mais execucao
mais fala
mais escuta real
mais continuidade
```

Se isso fizer voce estudar com mais constancia, o metodo ja venceu a parte mais dificil.

## Contribuindo

Ideias, issues e melhorias sao bem-vindas.

Boas contribuicoes:

- melhorar UX do agente;
- criar novos drills de speaking;
- melhorar roteamento de tools;
- adicionar testes de consistencia;
- melhorar instalacao;
- testar com modelos diferentes.

## Licenca

MIT. Use, adapte, teste e melhore.
