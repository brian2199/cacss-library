# Production deployment (Cloudflare Workers)

## Architecture

- **Application:** Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare)
- **Database:** Hosted PostgreSQL (e.g. [Neon](https://neon.tech)) — **not** local Docker
- **Migrations:** Run explicitly in CI or before deploy (`prisma migrate deploy`)

## Prerequisites

1. Cloudflare account + API token (`Workers Scripts: Edit`)
2. Neon (or compatible) PostgreSQL with connection string
3. GitHub repository secrets (if using Actions)

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Hosted Postgres; use pooled/serverless URL if recommended by provider |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | Yes | Set `true` in `wrangler.jsonc` vars |

Never commit production values.

## One-time database setup

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
# Do NOT run demo seed in production unless ALLOW_DEMO_SEED=true (not recommended)
```

Create the first admin user through a secure bootstrap process (manual SQL, one-off script, or invitation flow).

## Deploy locally

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
export DATABASE_URL=...
export AUTH_SECRET=...
npm run deploy
echo "$DATABASE_URL" | npx wrangler secret put DATABASE_URL
echo "$AUTH_SECRET" | npx wrangler secret put AUTH_SECRET
```

URL: `https://cacss-library.<your-subdomain>.workers.dev`

## GitHub Actions

- **`.github/workflows/ci.yml`** — validates PRs (lint, test, build, OpenNext)
- **`.github/workflows/deploy-cloudflare.yml`** — deploy on push to `main` (requires secrets)

## Verification checklist

1. `GET /api/health` returns OK
2. Login with production admin account
3. Staff routes require librarian/admin role
4. Checkout transaction against hosted DB
5. Cloudflare observability logs — no Prisma connection errors

## Rollback

- Redeploy previous Worker version from Cloudflare dashboard
- Database migrations are forward-only — plan rollback SQL before destructive changes

## Known limitations

- Live deploy from this agent requires your Cloudflare credentials
- Long-lived Prisma TCP pools may need Neon serverless driver or Hyperdrive under load
- PDF import (`pdf-parse`) is Node-heavy — verify Workers compatibility for your usage
