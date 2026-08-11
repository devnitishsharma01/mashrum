#!/usr/bin/env bash
# Start a local Redis suitable for Mashrum BullMQ (avoids broken Homebrew module paths).
set -euo pipefail

REDIS_BIN="${REDIS_BIN:-/opt/homebrew/opt/redis/bin/redis-server}"
PORT="${REDIS_PORT:-6379}"

if ! command -v redis-cli >/dev/null 2>&1 && [[ ! -x /opt/homebrew/opt/redis/bin/redis-cli ]]; then
  echo "redis-cli not found. Install with: brew install redis"
  exit 1
fi

CLI="${REDIS_CLI:-/opt/homebrew/opt/redis/bin/redis-cli}"

if "$CLI" -p "$PORT" ping >/dev/null 2>&1; then
  echo "Redis already running on port $PORT"
  exit 0
fi

"$REDIS_BIN" \
  --port "$PORT" \
  --bind 127.0.0.1 \
  --daemonize yes \
  --dir /tmp \
  --dbfilename mashrum-redis.rdb \
  --save ""

sleep 0.5
"$CLI" -p "$PORT" ping
echo "Redis started on 127.0.0.1:$PORT"
