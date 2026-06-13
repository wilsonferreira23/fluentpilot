#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$HOME/fluentpilot-estudos}"
AGENT_DIR="$HOME/.config/opencode/agents"

mkdir -p "$AGENT_DIR"
cp "$SCRIPT_DIR/global-agent/fluentpilot.md" "$AGENT_DIR/fluentpilot.md"

if [[ -e "$TARGET_DIR" ]]; then
  echo "Erro: o diretório já existe: $TARGET_DIR" >&2
  echo "Copie manualmente para não sobrescrever seu progresso." >&2
  exit 1
fi

cp -R "$SCRIPT_DIR/project-template" "$TARGET_DIR"
mkdir -p "$TARGET_DIR/legendas"

echo "FluentPilot instalado."
echo "Projeto: $TARGET_DIR"
echo "Abra com: cd \"$TARGET_DIR\" && opencode"
