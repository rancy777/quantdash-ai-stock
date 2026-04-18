#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
mkdir -p "$RUNTIME_DIR"

DEBUG_PORT="${DEBUG_PORT:-19223}"
PROFILE_DIR="${TMPDIR:-/tmp}/quantdash-newsfilter-chrome"
CHROME_EXE=""

for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
do
  if [ -x "$candidate" ]; then
    CHROME_EXE="$candidate"
    break
  fi
done

if [ -z "$CHROME_EXE" ]; then
  for binary in google-chrome chrome chromium chromium-browser; do
    if command -v "$binary" >/dev/null 2>&1; then
      CHROME_EXE="$(command -v "$binary")"
      break
    fi
  done
fi

if [ -z "$CHROME_EXE" ]; then
  echo "[ERROR] Chrome not found. NewsFilter remote-debug browser cannot be started."
  echo "[ERROR] Frontend and backend can still run, but NewsFilter collection will not work."
  exit 1
fi

echo "[INFO] Starting Chrome remote-debug instance..."
echo "[INFO] Chrome: $CHROME_EXE"
echo "[INFO] Port: $DEBUG_PORT"
echo "[INFO] Profile: $PROFILE_DIR"

nohup "$CHROME_EXE" \
  --remote-debugging-port="$DEBUG_PORT" \
  --user-data-dir="$PROFILE_DIR" \
  >/dev/null 2>&1 < /dev/null &

echo "$!" > "$RUNTIME_DIR/newsfilter_chrome.pid"
echo "[INFO] Chrome debug PID: $(cat "$RUNTIME_DIR/newsfilter_chrome.pid")"
