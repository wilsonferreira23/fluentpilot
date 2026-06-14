# Instalação no Hermes

O FluentPilot também pode rodar no Hermes com estado local, ferramentas pedagógicas e o mesmo diretório `.ingles-em-contexto/` usado no OpenCode.

## Pré-requisito

Instale o Hermes pela documentação oficial:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

Depois:

```bash
source ~/.zshrc
hermes setup --portal
hermes doctor
```

No Windows, use o instalador PowerShell oficial:

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

## Instalação rápida do FluentPilot

Na raiz do repositório:

```bash
./install-hermes.sh
```

Isso cria ou atualiza:

```text
~/.hermes/profiles/fluentpilot/
├── SOUL.md
├── AGENTS.md
├── config.yaml
├── cron/
├── skills/fluentpilot/SKILL.md
└── plugins/fluentpilot/
```

Também prepara o projeto de estudo:

```text
~/fluentpilot-estudos/
├── AGENTS.md
├── MEMORY_RULES.md
├── legendas/
└── .ingles-em-contexto/
```

## Como abrir

```bash
fluentpilot chat
```

Se o alias ainda não existir no seu terminal:

```bash
hermes profile create fluentpilot
fluentpilot plugins enable fluentpilot
hermes profile use fluentpilot
hermes chat
```

Dentro do chat, diga:

```text
diagnostico
```

Depois:

```text
começar
```

## Como verificar se as ferramentas carregaram

No Hermes:

```text
/plugins
```

Você deve ver o plugin `fluentpilot`.

Também pode rodar:

```bash
HERMES_PLUGINS_DEBUG=1 hermes plugins list
```

Se aparecer erro, veja:

```bash
hermes logs --level WARNING | grep -i plugin
```

## O que funciona no Hermes

O plugin Hermes expõe ferramentas equivalentes às principais ferramentas do OpenCode:

- `fluentpilot_health`
- `study_memory_bootstrap`
- `study_memory_get_state`
- `study_memory_append_event`
- `study_memory_update_mastery`
- `learning_engine_bootstrap`
- `learning_engine_analyze_subtitles`
- `snowball_engine_bootstrap`
- `snowball_engine_analyze_season`
- `snowball_engine_build_daily_mission`
- `snowball_engine_build_production_first_drill`
- `snowball_engine_build_speaking_reps_drill`
- `snowball_engine_build_captionless_listening_drill`
- `snowball_engine_build_unpredictable_conversation_drill`
- `snowball_engine_build_real_life_transfer`
- `snowball_engine_build_war_mode`
- `snowball_engine_build_return_mode`
- `snowball_engine_functional_capability_dashboard`
- `snowball_engine_calculate_fluency_score`
- `snowball_engine_complete_daily_mission`
- `media_clips_probe`
- `media_clips_extract`
- `fluentpilot_cron_daily_nudge`
- `fluentpilot_cron_energy_checkin`
- `fluentpilot_cron_absence_reactivation`
- `fluentpilot_cron_future_review`
- `fluentpilot_cron_monthly_blind_test`
- `fluentpilot_cron_weekly_progress_summary`

O comportamento esperado é o mesmo:

```text
Hoje você vai fazer:
Por quê:
Primeira ação:
```

O aluno recebe a próxima ação de maior retorno sem precisar decidir o plano do dia.

## Estado compartilhado

O Hermes grava progresso em:

```text
.ingles-em-contexto/
```

Por padrão, o instalador usa:

```text
~/fluentpilot-estudos/.ingles-em-contexto/
```

Se quiser usar outra pasta:

```bash
FLUENTPILOT_HOME="/caminho/do/projeto" fluentpilot chat
```

## WhatsApp e cron

O Hermes roda cron pelo gateway. Para os nudges chegarem no WhatsApp, configure o WhatsApp no Hermes e mantenha o gateway ativo:

```bash
hermes gateway start
```

Depois instale os jobs padrão:

```bash
FLUENTPILOT_INSTALL_CRON=1 FLUENTPILOT_CRON_DELIVER=whatsapp ./install-hermes.sh
```

Jobs instalados:

```text
fluentpilot-daily-mission-nudge      08:00 todos os dias
fluentpilot-energy-checkin           19:30 todos os dias
fluentpilot-absence-reactivation     12:00 todos os dias
fluentpilot-future-review            18:00 segunda a sábado
fluentpilot-monthly-blind-test       08:30 no dia 1 de cada mês
fluentpilot-weekly-progress-summary  20:00 domingo
```

Cada cron job é autocontido porque o Hermes executa jobs em sessões novas. O job lê `.ingles-em-contexto/`, chama a ferramenta `fluentpilot_cron_*` correspondente e entrega só a mensagem final.

Para listar:

```bash
fluentpilot cron list
```

Para testar um job:

```bash
fluentpilot cron run fluentpilot-daily-mission-nudge
```

Se um job não tiver nada útil para enviar, ele responde `[SILENT]` e o Hermes suprime a entrega.

## Áudio local

O Hermes também expõe `media_clips_probe` e `media_clips_extract`.

Regras:

- só usa mídia local fornecida pelo usuário;
- extrai trechos curtos;
- salva apenas dentro de `.ingles-em-contexto/media-clips/`;
- exige `ffmpeg` e `ffprobe` instalados.

## Base na documentação do Hermes

Esta integração segue os pontos oficiais:

- plugins Python ficam em `~/.hermes/plugins/<plugin>/`;
- o plugin precisa de `plugin.yaml`, `schemas.py`, `tools.py` e `__init__.py`;
- ferramentas são registradas com `ctx.register_tool`;
- cron jobs podem usar `deliver="whatsapp"` e `workdir` para rodar dentro do projeto;
- profiles ficam em diretórios separados e podem ter `SOUL.md`, `config.yaml`, skills e plugins.

Referências:

- [Hermes installation](https://hermes-agent.nousresearch.com/docs/getting-started/installation/)
- [Hermes plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins)
- [Build a Hermes plugin](https://hermes-agent.nousresearch.com/docs/guides/build-a-hermes-plugin)
- [Hermes cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)
- [Hermes messaging gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging)
- [Hermes profile distributions](https://hermes-agent.nousresearch.com/docs/user-guide/profile-distributions)
