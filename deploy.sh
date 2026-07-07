#!/usr/bin/env bash
# One-command deploy for the full Bull Run stack (front-end + reconstructed API).
#
#   ./deploy.sh
#
# - Generates a strong JWT_SECRET into .env on first run (never overwrites one).
# - Builds and starts the stack with Docker Compose.
# - Waits for the API health check and prints where the site is served.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required: https://docs.docker.com/get-docker/" >&2
  exit 1
fi

# 1. Ensure .env with a JWT secret exists.
if [ ! -f .env ] || ! grep -q '^JWT_SECRET=.\+' .env 2>/dev/null; then
  secret="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null \
            || openssl rand -hex 48)"
  { grep -v '^JWT_SECRET=' .env 2>/dev/null || true; echo "JWT_SECRET=${secret}"; } > .env.tmp
  mv .env.tmp .env
  echo "Wrote a new JWT_SECRET to .env"
fi

# 2. Build and start.
echo "Building and starting the stack..."
docker compose up -d --build

# 3. Wait for health.
port="$(grep -E '^WEB_PORT=' .env | cut -d= -f2)"; port="${port:-80}"
echo -n "Waiting for the site to come up"
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${port}/api/health" >/dev/null 2>&1; then
    echo
    echo "Bull Run is live at: http://localhost:${port}"
    echo "  (on a server, point your domain's DNS at this machine and put TLS in front — see deploy/DEPLOY.md)"
    exit 0
  fi
  echo -n "."; sleep 2
done
echo
echo "Started, but the health check didn't pass yet. Check logs with: docker compose logs -f"
