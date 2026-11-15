#!/usr/bin/env sh
# Build and start the EventMap stack, streaming all container logs into
# logs/eventapp_<YYYYMMDD-HHMMSS>.log (one file per start, see AGENTS.md "Logging").
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

mkdir -p logs
LOG_FILE="logs/eventapp_$(date +%Y%m%d-%H%M%S).log"

docker compose up -d --build

# Detached streamer: it exits on its own when the stack is stopped with `docker compose down`.
nohup docker compose logs -f --timestamps --no-color > "$LOG_FILE" 2>&1 &

echo "Logs:     $LOG_FILE"
echo "App:      http://localhost"
echo "Health:   http://localhost/api/health"
echo "API docs: http://localhost/api/v1/docs"
