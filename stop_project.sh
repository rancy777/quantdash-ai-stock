#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"

stop_pid_file() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/$name.pid"

  if [ ! -f "$pid_file" ]; then
    return
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "[INFO] Stopping $name process, PID $pid ..."
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi

  rm -f "$pid_file"
}

kill_port() {
  local port="$1"
  local label="$2"

  if ! command -v lsof >/dev/null 2>&1; then
    echo "[WARN] lsof not found. Skipping $label port check."
    return
  fi

  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null | sort -u || true)"

  if [ -z "$pids" ]; then
    echo "[INFO] $label port $port is clear."
    return
  fi

  local pid
  for pid in $pids; do
    echo "[INFO] Stopping $label process on port $port, PID $pid ..."
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done

  if lsof -ti tcp:"$port" >/dev/null 2>&1; then
    echo "[WARN] $label port $port is still in use."
  else
    echo "[INFO] $label port $port is clear."
  fi
}

stop_pid_file "backend"
stop_pid_file "frontend"
stop_pid_file "news"
stop_pid_file "newsfilter_chrome"

kill_port "5173" "Frontend"
kill_port "7878" "Backend"

echo
echo "[INFO] Stop check completed."
