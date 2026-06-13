#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$HOME/fluentpilot-estudos}"
CONFIG_DIRS=("$HOME/.config/opencode")
ACCOMPLISH_CONFIG_DIR="$HOME/Library/Application Support/Accomplish/opencode"

if [[ -d "$ACCOMPLISH_CONFIG_DIR" ]]; then
  CONFIG_DIRS+=("$ACCOMPLISH_CONFIG_DIR")
fi

for CONFIG_DIR in "${CONFIG_DIRS[@]}"; do
  AGENT_DIR="$CONFIG_DIR/agents"
  TOOL_DIR="$CONFIG_DIR/tools"
  mkdir -p "$AGENT_DIR"
  mkdir -p "$TOOL_DIR"
  cp "$SCRIPT_DIR/global-agent/fluentpilot.md" "$AGENT_DIR/fluentpilot.md"
  cp "$SCRIPT_DIR/project-template/.opencode/tools/"*.ts "$TOOL_DIR"/
  rm -f "$AGENT_DIR/ingles-em-contexto.md"
done

if [[ -e "$TARGET_DIR" ]]; then
  echo "Atualizando projeto existente sem apagar progresso: $TARGET_DIR"
  mkdir -p "$TARGET_DIR/.opencode/tools"
  cp "$SCRIPT_DIR/project-template/.opencode/tools/"*.ts "$TARGET_DIR/.opencode/tools"/
  cp "$SCRIPT_DIR/project-template/AGENTS.md" "$TARGET_DIR/AGENTS.md"
  cp "$SCRIPT_DIR/project-template/MEMORY_RULES.md" "$TARGET_DIR/MEMORY_RULES.md"
  cp "$SCRIPT_DIR/project-template/opencode.json" "$TARGET_DIR/opencode.json"
  if [[ -f "$SCRIPT_DIR/project-template/.opencode/package.json" ]]; then
    cp "$SCRIPT_DIR/project-template/.opencode/package.json" "$TARGET_DIR/.opencode/package.json"
  fi
else
  cp -R "$SCRIPT_DIR/project-template" "$TARGET_DIR"
  mkdir -p "$TARGET_DIR/legendas"
fi

echo "FluentPilot instalado."
echo "Projeto: $TARGET_DIR"
for CONFIG_DIR in "${CONFIG_DIRS[@]}"; do
  echo "Agente global: $CONFIG_DIR/agents/fluentpilot.md"
  echo "Tools globais: $CONFIG_DIR/tools"
done
echo "Abra com: cd \"$TARGET_DIR\" && opencode"
echo "No OpenCode, selecione o agente fluentpilot e diga: diagnostico"
