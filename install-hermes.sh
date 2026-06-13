#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_NAME="${FLUENTPILOT_HERMES_PROFILE:-fluentpilot}"
TARGET_DIR="${1:-$HOME/fluentpilot-estudos}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
PROFILE_HOME="$HERMES_HOME/profiles/$PROFILE_NAME"

if ! command -v hermes >/dev/null 2>&1; then
  echo "Hermes não encontrado."
  echo "Instale primeiro pela documentação oficial:"
  echo "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
  echo "Depois rode: source ~/.zshrc && hermes setup --portal && hermes doctor"
  exit 1
fi

mkdir -p "$PROFILE_HOME/plugins" "$PROFILE_HOME/skills" "$TARGET_DIR/legendas"

cp "$SCRIPT_DIR/hermes/SOUL.md" "$PROFILE_HOME/SOUL.md"
cp "$SCRIPT_DIR/hermes/AGENTS.md" "$PROFILE_HOME/AGENTS.md"
cp "$SCRIPT_DIR/hermes/config.yaml" "$PROFILE_HOME/config.yaml"
cp -R "$SCRIPT_DIR/hermes/skills/fluentpilot" "$PROFILE_HOME/skills/"
rm -rf "$PROFILE_HOME/plugins/fluentpilot"
cp -R "$SCRIPT_DIR/hermes/plugins/fluentpilot" "$PROFILE_HOME/plugins/fluentpilot"

if [[ -e "$TARGET_DIR" ]]; then
  echo "Atualizando projeto de estudo sem apagar progresso: $TARGET_DIR"
  cp "$SCRIPT_DIR/project-template/AGENTS.md" "$TARGET_DIR/AGENTS.md"
  cp "$SCRIPT_DIR/project-template/MEMORY_RULES.md" "$TARGET_DIR/MEMORY_RULES.md"
else
  cp -R "$SCRIPT_DIR/project-template" "$TARGET_DIR"
  mkdir -p "$TARGET_DIR/legendas"
fi

if hermes profile list >/dev/null 2>&1; then
  if ! hermes profile list | grep -qE "(^|[[:space:]])$PROFILE_NAME($|[[:space:]])"; then
    hermes profile create "$PROFILE_NAME" >/dev/null 2>&1 || true
  fi
fi

if command -v "$PROFILE_NAME" >/dev/null 2>&1; then
  "$PROFILE_NAME" plugins enable fluentpilot >/dev/null 2>&1 || true
else
  hermes -p "$PROFILE_NAME" plugins enable fluentpilot >/dev/null 2>&1 || true
fi

echo "FluentPilot instalado no Hermes."
echo "Perfil Hermes: $PROFILE_NAME"
echo "Profile home: $PROFILE_HOME"
echo "Projeto de estudo: $TARGET_DIR"
echo ""
echo "Abra com:"
echo "  cd \"$TARGET_DIR\""
echo "  fluentpilot chat"
echo ""
echo "Se o alias fluentpilot não existir:"
echo "  hermes profile use fluentpilot"
echo "  hermes chat"
echo ""
echo "No Hermes, diga: diagnostico"
