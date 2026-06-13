#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$HOME/fluentpilot-estudos}"
AGENT_DIR="$HOME/.config/opencode/agents"
TOOL_DIR="$HOME/.config/opencode/tools"

mkdir -p "$AGENT_DIR"
mkdir -p "$TOOL_DIR"
cp "$SCRIPT_DIR/global-agent/fluentpilot.md" "$AGENT_DIR/fluentpilot.md"
cp "$SCRIPT_DIR/project-template/.opencode/tools/"*.ts "$TOOL_DIR"/
rm -f "$AGENT_DIR/ingles-em-contexto.md"

if [[ -e "$TARGET_DIR" ]]; then
  echo "Erro: o diretório já existe: $TARGET_DIR" >&2
  echo "Copie manualmente para não sobrescrever seu progresso." >&2
  exit 1
fi

cp -R "$SCRIPT_DIR/project-template" "$TARGET_DIR"
mkdir -p "$TARGET_DIR/legendas"

echo "FluentPilot instalado."
echo "Projeto: $TARGET_DIR"
echo "Agente global: $AGENT_DIR/fluentpilot.md"
echo "Tools globais: $TOOL_DIR"
echo "Agente antigo removido, se existia: $AGENT_DIR/ingles-em-contexto.md"
echo "Abra com: cd \"$TARGET_DIR\" && opencode"
echo "No OpenCode, selecione o agente fluentpilot e diga: diagnostico"
