#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f ".env.oracle" ]; then
  echo "ERROR: .env.oracle not found. Copy .env.oracle.example to .env.oracle and configure your secrets."
  exit 1
fi

set -a
source .env.oracle
set +a

echo "[Order It Up] Building and starting unified Oracle Cloud backend..."
docker compose --env-file .env.oracle build --pull
docker compose --env-file .env.oracle up -d

echo "[Order It Up] Waiting for health check..."
for i in $(seq 1 30); do
  if docker compose exec -T orderitup-backend curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "[Order It Up] Server is healthy!"
    break
  fi
  sleep 2
done

echo "[Order It Up] Checking /ready..."
docker compose exec -T orderitup-backend curl -fsS http://127.0.0.1:8080/ready
echo ""
echo "[Order It Up] Deployment complete."
