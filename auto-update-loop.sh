#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_INTERVAL="${UPDATE_INTERVAL:-900}"
UPDATE_REF="${UPDATE_REF:-main}"

[[ "$UPDATE_INTERVAL" =~ ^[0-9]+$ ]] && (( UPDATE_INTERVAL >= 60 )) || { echo "UPDATE_INTERVAL deve essere almeno 60 secondi." >&2; exit 1; }

while true; do
  sleep "$UPDATE_INTERVAL"
  UPDATE_REF="$UPDATE_REF" "$APP_DIR/update-from-github.sh" || echo "$(date -Is) aggiornamento non riuscito; verra ritentato."
done
