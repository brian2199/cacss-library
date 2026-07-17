# Local development

## Requirements

- **Node.js 22+** (see `.nvmrc`)
- **PostgreSQL 16** — Docker Compose (recommended) or a native install
- **npm** 10+

## One-command local setup

```bash
npm run local:setup   # creates .env, migrates, seeds demo data
npm test              # Vitest unit tests
npm run local:test    # setup + unit tests + typecheck
npm run dev           # http://localhost:3001
```

`local:setup` prefers Docker Compose (`db` on host port **5433**). If Docker is unavailable but Postgres is already listening on **5432**, it uses that instead.

## Manual quick start (Docker)

```bash
cp .env.example .env
# Set AUTH_SECRET: openssl rand -base64 32
# DATABASE_URL uses host port 5433 (see docker-compose.yml)

docker compose up -d db
npm ci
npx prisma migrate deploy
npm run db:seed   # development only
npm run dev
```

Open **http://localhost:3001**

## Manual quick start (native Postgres, no Docker)

```bash
# Ensure Postgres is running and database exists:
#   createdb -O postgres cacss   (or equivalent)
# Role password should be postgres for the default URL below.

cp .env.example .env
# Set DATABASE_URL to port 5432 (not 5433):
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cacss?schema=public"
# Set AUTH_SECRET: openssl rand -base64 32

npm ci
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Ports

| Service | Host port | Notes |
|---------|-----------|-------|
| Next.js app | **3001** | Always — do not use 3000 |
| PostgreSQL (Docker) | **5433** | Maps to container 5432 |
| PostgreSQL (native) | **5432** | Use this in `.env` when not using Docker |

## Demo credentials (development seed only)

After `npm run db:seed`:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@cacss.library` | `cacss-demo` |
| Librarian | `librarian@cacss.library` | `cacss-demo` |
| Member | `member@cacss.library` | `cacss-demo` |

**Production:** seed refuses to run unless `ALLOW_DEMO_SEED=true`. Never use shared demo passwords in production.

## Useful commands

```bash
npm run dev          # Turbopack dev server on 3001
npm run build        # Production Next.js build
npm test             # Vitest unit tests
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run db:studio    # Prisma Studio
npx opennextjs-cloudflare build   # Cloudflare bundle (no deploy)
```

## Troubleshooting

- **P1000 / P1012:** Check `.env` `DATABASE_URL` points to `localhost:5433` when using Docker db.
- **Port in use:** Another Postgres on 5432 is fine — we map **5433** on the host.
- **Hydration warnings from Grammarly:** Browser extension; not an app defect.
