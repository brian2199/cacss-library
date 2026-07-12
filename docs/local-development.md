# Local development

## Requirements

- **Node.js 22+** (see `.nvmrc`)
- **Docker** (recommended for PostgreSQL)
- **npm** 10+

## Quick start

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

## Ports

| Service | Host port | Container port |
|---------|-----------|----------------|
| Next.js app | **3001** | 3001 (in full stack) |
| PostgreSQL | **5433** | 5432 |

Do not use port 3000 — the app is configured for 3001.

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
