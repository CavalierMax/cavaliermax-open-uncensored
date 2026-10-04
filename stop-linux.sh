#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_DIR/.server.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Nessuna dashboard registrata come attiva."
  exit 0
fi

PID="$(<"$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Dashboard arrestata (PID $PID)."
else
  echo "Processo $PID non più attivo."
fi
rm -f "$PID_FILE"
