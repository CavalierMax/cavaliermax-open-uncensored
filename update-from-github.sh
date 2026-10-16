#!/usr/bin/env bash
set -Eeuo pipefail

# Downloads one complete, pinned GitHub revision before replacing any live file.
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY="${GITHUB_REPOSITORY:-CavalierMax/cavaliermax-open-uncensored}"
UPDATE_REF="${UPDATE_REF:-main}"
CURRENT_FILE="$APP_DIR/.github-revision"
RUNTIME_FILES=(index.html app.js styles.css command-deck.css start-linux.sh stop-linux.sh update-from-github.sh auto-update-loop.sh)

for command in curl tar install; do
  command -v "$command" >/dev/null 2>&1 || { echo "Comando richiesto non trovato: $command" >&2; exit 1; }
done

metadata="$(curl -fsSL --retry 2 "https://api.github.com/repos/$REPOSITORY/commits/$UPDATE_REF")"
revision="$(printf '%s' "$metadata" | grep -oE '"sha"[[:space:]]*:[[:space:]]*"[0-9a-f]{40}"' | head -n1 | sed -E 's/.*"([0-9a-f]{40})"/\1/')"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "Impossibile determinare la revisione GitHub per $UPDATE_REF." >&2; exit 1; }

if [[ -r "$CURRENT_FILE" && "$(<"$CURRENT_FILE")" == "$revision" ]]; then
  echo "Gia aggiornato a $revision."
  exit 0
fi

stage="$(mktemp -d "$APP_DIR/.update.XXXXXX")"
archive="$stage/source.tar.gz"
source_dir="$stage/source"
cleanup() {
  [[ "$stage" == "$APP_DIR"/.update.* && -d "$stage" ]] || return
  rm -rf -- "$stage"
}
trap cleanup EXIT

mkdir "$source_dir"
curl -fsSL --retry 2 "https://codeload.github.com/$REPOSITORY/tar.gz/$revision" -o "$archive"
tar -xzf "$archive" --strip-components=1 -C "$source_dir"

for file in "${RUNTIME_FILES[@]}"; do
  [[ -s "$source_dir/$file" ]] || { echo "Aggiornamento incompleto: manca $file." >&2; exit 1; }
done
bash -n "$source_dir/start-linux.sh" "$source_dir/stop-linux.sh" "$source_dir/update-from-github.sh" "$source_dir/auto-update-loop.sh"
if command -v node >/dev/null 2>&1; then node --check "$source_dir/app.js"; fi

was_running=0
if [[ -f "$APP_DIR/.server.pid" ]] && kill -0 "$(<"$APP_DIR/.server.pid")" 2>/dev/null; then
  was_running=1
  "$APP_DIR/stop-linux.sh"
fi

for file in "${RUNTIME_FILES[@]}"; do
  mode=640
  [[ "$file" == *.sh ]] && mode=750
  install -m "$mode" "$source_dir/$file" "$APP_DIR/$file"
done
printf '%s\n' "$revision" >"$CURRENT_FILE"

if [[ "$was_running" == 1 ]]; then "$APP_DIR/start-linux.sh"; fi
echo "Aggiornamento completato: $revision"
