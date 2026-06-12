#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$HOME/ingles-em-contexto-estudos}"
AGENT_DIR="$HOME/.config/opencode/agents"

mkdir -p "$AGENT_DIR"
cp "$SCRIPT_DIR/global-agent/ingles-em-contexto.md" "$AGENT_DIR/ingles-em-contexto.md"

if [[ -e "$TARGET_DIR" ]]; then
  echo "Erro: o diretório já existe: $TARGET_DIR" >&2
  echo "Copie manualmente para não sobrescrever seu progresso." >&2
  exit 1
fi

cp -R "$SCRIPT_DIR/project-template" "$TARGET_DIR"
mkdir -p "$TARGET_DIR/legendas"

echo "Inglês em Contexto V1 instalado."
echo "Projeto: $TARGET_DIR"
echo "Abra com: cd \"$TARGET_DIR\" && opencode"
