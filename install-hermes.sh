#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_NAME="${FLUENTPILOT_HERMES_PROFILE:-fluentpilot}"
TARGET_DIR="${1:-$HOME/fluentpilot-estudos}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
PROFILE_HOME="$HERMES_HOME/profiles/$PROFILE_NAME"
CRON_DELIVER="${FLUENTPILOT_CRON_DELIVER:-whatsapp}"

if ! command -v hermes >/dev/null 2>&1; then
  echo "Hermes não encontrado."
  echo "Instale primeiro pela documentação oficial:"
  echo "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
  echo "Depois rode: source ~/.zshrc && hermes setup --portal && hermes doctor"
  exit 1
fi

mkdir -p "$PROFILE_HOME/plugins" "$PROFILE_HOME/skills" "$PROFILE_HOME/cron" "$TARGET_DIR/legendas"

cp "$SCRIPT_DIR/hermes/SOUL.md" "$PROFILE_HOME/SOUL.md"
cp "$SCRIPT_DIR/hermes/AGENTS.md" "$PROFILE_HOME/AGENTS.md"
cp "$SCRIPT_DIR/hermes/config.yaml" "$PROFILE_HOME/config.yaml"
cp -R "$SCRIPT_DIR/hermes/skills/fluentpilot" "$PROFILE_HOME/skills/"
cp "$SCRIPT_DIR/hermes/cron/"*.json "$PROFILE_HOME/cron/"
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

run_hermes_profile() {
  if command -v "$PROFILE_NAME" >/dev/null 2>&1; then
    "$PROFILE_NAME" "$@"
  else
    hermes -p "$PROFILE_NAME" "$@"
  fi
}

if [[ "${FLUENTPILOT_INSTALL_CRON:-0}" == "1" ]]; then
  PYTHON_BIN="${PYTHON_BIN:-python3}"
  if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    echo "Python não encontrado; não foi possível agendar cron jobs automaticamente."
    echo "Os templates foram copiados para: $PROFILE_HOME/cron"
  else
    for CRON_FILE in "$SCRIPT_DIR/hermes/cron/"*.json; do
      NAME="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["name"])' "$CRON_FILE")"
      SCHEDULE="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["schedule"])' "$CRON_FILE")"
      PROMPT="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["prompt"])' "$CRON_FILE")"
      run_hermes_profile cron create "$SCHEDULE" "$PROMPT" \
        --skill fluentpilot \
        --name "$NAME" \
        --workdir "$TARGET_DIR" \
        --deliver "$CRON_DELIVER" >/dev/null 2>&1 || true
      echo "Cron configurado: $NAME -> $CRON_DELIVER"
    done
  fi
fi

echo "FluentPilot instalado no Hermes."
echo "Perfil Hermes: $PROFILE_NAME"
echo "Profile home: $PROFILE_HOME"
echo "Projeto de estudo: $TARGET_DIR"
echo "Cron templates: $PROFILE_HOME/cron"
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
echo ""
echo "Para instalar nudges automáticos no WhatsApp:"
echo "  FLUENTPILOT_INSTALL_CRON=1 FLUENTPILOT_CRON_DELIVER=whatsapp ./install-hermes.sh"
echo "Depois mantenha o gateway ativo com:"
echo "  hermes gateway start"
