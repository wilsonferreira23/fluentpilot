# File Structure

```text
fluentpilot/
├── README.md
├── install.sh
├── install.ps1
├── install-hermes.sh
├── global-agent/
│   └── fluentpilot.md
├── hermes/
│   ├── SOUL.md
│   ├── AGENTS.md
│   ├── config.yaml
│   ├── cron/
│   ├── skills/fluentpilot/SKILL.md
│   └── plugins/fluentpilot/
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
│   ├── INSTALLATION_NOTES.md
│   └── HERMES_INSTALLATION.md
└── tests/
```

## Separacao

- Raiz: entrada do projeto e instaladores.
- `global-agent/`: agente global do OpenCode.
- `hermes/`: distribuição do FluentPilot para Hermes.
- `project-template/`: arquivos copiados para o projeto de estudo.
- `docs/`: explicacao do metodo, arquitetura e manutencao.
- `tests/`: testes de core, consistencia OpenCode e estrutura Hermes.

## Instalacao OpenCode

O instalador tambem copia:

```text
global-agent/fluentpilot.md -> ~/.config/opencode/agents/fluentpilot.md
project-template/.opencode/tools/*.ts -> ~/.config/opencode/tools/
```

Isso permite que o agente global enxergue os custom tools mesmo quando o OpenCode carrega agentes globais antes dos tools locais do projeto.

## Instalacao Hermes

O instalador tambem copia:

```text
hermes/SOUL.md -> ~/.hermes/profiles/fluentpilot/SOUL.md
hermes/AGENTS.md -> ~/.hermes/profiles/fluentpilot/AGENTS.md
hermes/config.yaml -> ~/.hermes/profiles/fluentpilot/config.yaml
hermes/cron/*.json -> ~/.hermes/profiles/fluentpilot/cron/
hermes/skills/fluentpilot -> ~/.hermes/profiles/fluentpilot/skills/fluentpilot
hermes/plugins/fluentpilot -> ~/.hermes/profiles/fluentpilot/plugins/fluentpilot
```

O plugin Hermes usa Python e grava no mesmo estado local `.ingles-em-contexto/`.

Se `FLUENTPILOT_INSTALL_CRON=1`, o instalador agenda os jobs com `--deliver "$FLUENTPILOT_CRON_DELIVER"` e `--workdir "$TARGET_DIR"`.
