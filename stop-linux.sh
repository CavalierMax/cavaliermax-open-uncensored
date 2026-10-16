#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_DIR/.server.pid"
UPDATER_PID_FILE="$APP_DIR/.updater.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(<"$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Dashboard arrestata (PID $PID)."
  else
    echo "Processo $PID non più attivo."
  fi
  rm -f "$PID_FILE"
else
  echo "Nessuna dashboard registrata come attiva."
fi

if [[ -f "$UPDATER_PID_FILE" ]]; then
  UPDATER_PID="$(<"$UPDATER_PID_FILE")"
  if kill -0 "$UPDATER_PID" 2>/dev/null; then
    kill "$UPDATER_PID"
    echo "Controllo aggiornamenti arrestato (PID $UPDATER_PID)."
  fi
  rm -f "$UPDATER_PID_FILE"
fi
