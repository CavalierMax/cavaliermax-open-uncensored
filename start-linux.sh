#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-192.168.1.144}"
PORT="${PORT:-8786}"
PID_FILE="$APP_DIR/.server.pid"
LOG_FILE="$APP_DIR/server.log"
UPDATER_PID_FILE="$APP_DIR/.updater.pid"
AUTO_UPDATE=0
UPDATE_INTERVAL=900
UPDATE_REF="main"

if [[ -r "$APP_DIR/.auto-update.env" ]]; then
  while IFS='=' read -r key value; do
    case "$key" in
      AUTO_UPDATE) AUTO_UPDATE="$value" ;;
      UPDATE_INTERVAL) UPDATE_INTERVAL="$value" ;;
      UPDATE_REF) UPDATE_REF="$value" ;;
    esac
  done < <(grep -E '^(AUTO_UPDATE|UPDATE_INTERVAL|UPDATE_REF)=' "$APP_DIR/.auto-update.env" || true)
fi

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

if [[ "$AUTO_UPDATE" == "1" && -x "$APP_DIR/auto-update-loop.sh" ]]; then
  if [[ ! -f "$UPDATER_PID_FILE" ]] || ! kill -0 "$(<"$UPDATER_PID_FILE")" 2>/dev/null; then
    nohup env UPDATE_INTERVAL="$UPDATE_INTERVAL" UPDATE_REF="$UPDATE_REF" "$APP_DIR/auto-update-loop.sh" >>"$APP_DIR/updater.log" 2>&1 &
    echo $! >"$UPDATER_PID_FILE"
    echo "Aggiornamento automatico attivo ogni ${UPDATE_INTERVAL}s (ref: ${UPDATE_REF})."
  fi
fi
