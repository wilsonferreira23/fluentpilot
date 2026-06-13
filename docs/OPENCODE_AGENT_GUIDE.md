# OpenCode Agent Guide

Este projeto separa arquivos de runtime, tools e documentacao longa para funcionar bem no OpenCode.

## Arquivos de runtime

- `global-agent/fluentpilot.md`: prompt principal do agente global.
- `project-template/AGENTS.md`: regras curtas lidas no projeto instalado.
- `project-template/MEMORY_RULES.md`: instrucoes de runtime carregadas por `opencode.json`.
- `project-template/opencode.json`: aponta para `MEMORY_RULES.md`.
- `~/.config/opencode/tools/`: copia global dos tools feita pelo instalador.

## Tools

As ferramentas ficam em:

```text
project-template/.opencode/tools/
```

Responsabilidades:

- `fluentpilot_health.ts`: diagnostico de instalacao e visibilidade dos tools.
- `study_memory.ts`: estado pedagogico base.
- `learning_engine.ts`: curriculo, revisao, cobertura e sessoes.
- `snowball_core.ts`: funcoes puras e testaveis.
- `snowball_engine.ts`: wrappers OpenCode e persistencia.
- `media_clips.ts`: audio/video local com permissao.

## Regra de operacao

Antes de qualquer resposta de estudo, o agente deve inicializar memoria e motores:

```text
study_memory_bootstrap
study_memory_get_state
learning_engine_bootstrap
snowball_engine_bootstrap
```

Depois disso, deve continuar da proxima acao validada pelo estado em disco.

## Diagnostico

Se o agente disser que os tools nao existem, o processo atual do OpenCode nao carregou custom tools.

Causas comuns:

- OpenCode foi aberto fora do projeto instalado;
- OpenCode/Accomplish nao foi reiniciado apos instalar;
- tools foram copiados para `~/.config/opencode`, mas o app macOS esta usando `~/Library/Application Support/Accomplish/opencode`;
- projeto existente nao recebeu a versao nova dos tools.

Teste dentro do OpenCode:

```text
diagnostico
```

O agente deve chamar `fluentpilot_health`.

Se ate `fluentpilot_health` nao existir, reinstale:

```bash
cd fluentpilot
./install.sh
cd ~/fluentpilot-estudos
opencode
```

O instalador pode ser rodado novamente. Ele atualiza prompt, tools e arquivos de runtime sem apagar `.ingles-em-contexto` nem `legendas`.

## Contrato diario

Quando o aluno disser `continuar`, o agente nao pergunta o que estudar.

Ele monta a missao e responde no formato:

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
