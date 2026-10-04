#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-192.168.1.144}"
PORT="${PORT:-8786}"
PID_FILE="$APP_DIR/.server.pid"
LOG_FILE="$APP_DIR/server.log"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 non trovato." >&2
  exit 1
fi

if [[ -f "$PID_FILE" ]] && kill -0 "$(<"$PID_FILE")" 2>/dev/null; then
  echo "Dashboard già attiva (PID $(<"$PID_FILE"))."
  exit 0
fi

rm -f "$PID_FILE"
nohup python3 -m http.server "$PORT" --bind "$HOST" --directory "$APP_DIR" >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
sleep 1

if kill -0 "$(<"$PID_FILE")" 2>/dev/null; then
  echo "Dashboard attiva su http://$HOST:$PORT/"
else
  echo "Avvio fallito: consulta $LOG_FILE" >&2
  rm -f "$PID_FILE"
  exit 1
fi
