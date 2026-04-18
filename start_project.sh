#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
mkdir -p "$RUNTIME_DIR"

cd "$ROOT_DIR"

activate_venv() {
  if [ -f "$ROOT_DIR/venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    . "$ROOT_DIR/venv/bin/activate"
  fi
}

resolve_python_cmd() {
  if command -v python >/dev/null 2>&1; then
    echo "python"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return
  fi
  echo ""
}

start_detached() {
  local name="$1"
  local workdir="$2"
  local command="$3"
  local log_file="$RUNTIME_DIR/$name.log"
  local pid_file="$RUNTIME_DIR/$name.pid"
  local bootstrap=""

  if [ -f "$ROOT_DIR/venv/bin/activate" ]; then
    bootstrap=". \"$ROOT_DIR/venv/bin/activate\"; "
  fi

  nohup bash -lc "cd \"$workdir\"; $bootstrap$command" >"$log_file" 2>&1 < /dev/null &
  echo "$!" > "$pid_file"
  echo "[INFO] Started $name (PID $(cat "$pid_file")), log: $log_file"
}

activate_venv
PYTHON_CMD="$(resolve_python_cmd)"

echo
echo "[INFO] Project root: $ROOT_DIR"
echo "[INFO] Python:"
if [ -n "$PYTHON_CMD" ]; then
  "$PYTHON_CMD" --version
else
  echo "python not found"
fi
echo "[INFO] Node:"
node --version
echo "[INFO] NPM:"
npm --version
echo

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "[INFO] node_modules not found, installing dependencies..."
  npm install
fi

echo "[INFO] Clearing existing frontend/backend processes..."
bash "$ROOT_DIR/stop_project.sh"

if [ -z "$PYTHON_CMD" ]; then
  echo "[ERROR] python/python3 not found. Backend cannot be started."
  exit 1
fi

echo "[INFO] Starting backend on http://127.0.0.1:7878 ..."
start_detached "backend" "$ROOT_DIR" "$PYTHON_CMD scripts/screener_service.py"

echo "[INFO] Starting frontend dev server..."
start_detached "frontend" "$ROOT_DIR" "npm run dev"

NEWS_SCRIPT_DIR="$ROOT_DIR/dingding盘中资讯2/dingding盘中资讯"
START_EXTERNAL_NEWS_VALUE="${START_EXTERNAL_NEWS:-}"

if [ "$START_EXTERNAL_NEWS_VALUE" = "1" ]; then
  if [ -f "$ROOT_DIR/start_newsfilter_chrome.sh" ]; then
    echo "[INFO] START_EXTERNAL_NEWS=1, starting NewsFilter Chrome debug instance on port 19223 ..."
    bash "$ROOT_DIR/start_newsfilter_chrome.sh"
    sleep 1
    if curl -fsS "http://127.0.0.1:19223/json/version" >/dev/null 2>&1; then
      echo "[INFO] NewsFilter Chrome debug port is ready."
    else
      echo "[WARN] Chrome debug port 19223 is not reachable. NewsFilter capture may fail."
    fi
  else
    echo "[WARN] NewsFilter Chrome launcher not found: $ROOT_DIR/start_newsfilter_chrome.sh"
  fi
else
  echo "[INFO] External NewsFilter collection is disabled by default."
  echo "[INFO] Only CLS news collector will be started. Set START_EXTERNAL_NEWS=1 to re-enable NewsFilter."
fi

if [ -d "$NEWS_SCRIPT_DIR" ]; then
  if [ "$START_EXTERNAL_NEWS_VALUE" = "1" ]; then
    echo "[INFO] Starting news collectors (CLS + External)..."
    start_detached "news" "$NEWS_SCRIPT_DIR" "$PYTHON_CMD run_both.py"
  else
    echo "[INFO] Starting CLS news collector only..."
    start_detached "news" "$NEWS_SCRIPT_DIR" "$PYTHON_CMD cls_telegraph_to_dingtalk_single.py"
  fi
else
  echo "[WARN] News script directory not found: $NEWS_SCRIPT_DIR"
fi

echo
echo "[INFO] Frontend: http://localhost:5173"
echo "[INFO] Backend:  http://127.0.0.1:7878"
echo "[INFO] Logs:     $RUNTIME_DIR"
