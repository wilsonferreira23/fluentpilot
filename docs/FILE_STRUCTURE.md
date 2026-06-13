# File Structure

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

## Separacao

- Raiz: entrada do projeto e instaladores.
- `global-agent/`: agente global do OpenCode.
- `project-template/`: arquivos copiados para o projeto de estudo.
- `docs/`: explicacao do metodo, arquitetura e manutencao.
- `tests/`: testes de core e consistencia OpenCode.
