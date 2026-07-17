#!/usr/bin/env bash
# Bootstrap CACSS Library for local testing (Docker optional).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT_DOCKER=5433
PORT_NATIVE=5432

have_cmd() { command -v "$1" >/dev/null 2>&1; }

detect_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "$DATABASE_URL"
    return
  fi

  if have_cmd docker && docker compose version >/dev/null 2>&1; then
    if docker compose ps db --status running --format '{{.Name}}' 2>/dev/null | grep -q .; then
      echo "postgresql://postgres:postgres@localhost:${PORT_DOCKER}/cacss?schema=public"
      return
    fi
  fi

  if have_cmd pg_isready && pg_isready -h localhost -p "$PORT_NATIVE" -q 2>/dev/null; then
    echo "postgresql://postgres:postgres@localhost:${PORT_NATIVE}/cacss?schema=public"
    return
  fi

  if have_cmd pg_isready && pg_isready -h localhost -p "$PORT_DOCKER" -q 2>/dev/null; then
    echo "postgresql://postgres:postgres@localhost:${PORT_DOCKER}/cacss?schema=public"
    return
  fi

  echo ""
}

ensure_env() {
  if [[ -f .env ]]; then
    echo "Using existing .env"
    return
  fi

  local url secret
  url="$(detect_database_url)"
  if [[ -z "$url" ]]; then
    cat <<'EOF' >&2
No PostgreSQL detected.

Option A (Docker):
  docker compose up -d db
  # then re-run: npm run local:setup

Option B (native Postgres on 5432):
  createuser -s postgres  # if needed
  createdb -O postgres cacss
  # set password postgres for role postgres, then re-run

Or copy .env.example to .env and set DATABASE_URL yourself.
EOF
    exit 1
  fi

  secret="$(openssl rand -base64 32)"
  cat > .env <<EOF
DATABASE_URL="${url}"
AUTH_SECRET="${secret}"
AUTH_TRUST_HOST="true"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
EOF
  echo "Created .env with DATABASE_URL=${url}"
}

start_docker_db_if_needed() {
  if [[ -f .env ]]; then
    return
  fi
  if have_cmd docker && docker compose version >/dev/null 2>&1; then
    if ! docker compose ps db --status running --format '{{.Name}}' 2>/dev/null | grep -q .; then
      if have_cmd pg_isready && pg_isready -h localhost -p "$PORT_NATIVE" -q 2>/dev/null; then
        return
      fi
      echo "Starting Postgres via Docker Compose..."
      docker compose up -d db
      # Wait for readiness
      for _ in $(seq 1 30); do
        if docker compose exec -T db pg_isready -U postgres -q 2>/dev/null; then
          break
        fi
        sleep 1
      done
    fi
  fi
}

main() {
  start_docker_db_if_needed
  ensure_env

  # shellcheck disable=SC1091
  set -a
  source .env
  set +a

  if [[ ! -d node_modules ]]; then
    npm ci
  else
    npx prisma generate
  fi

  npx prisma migrate deploy
  npm run db:seed

  echo ""
  echo "Local setup complete."
  echo "  npm test          # unit tests"
  echo "  npm run dev       # http://localhost:3001"
  echo "  Demo login: admin@cacss.library / cacss-demo"
}

main "$@"
