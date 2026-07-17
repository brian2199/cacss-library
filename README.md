# CACSS Library

Modern library operations console for the **Central Arizona Cactus & Succulent Society (CACSS)** — tuned for rare botanical books, society journals, DVDs, youth shelves, convention guides, and archival folders.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Node 22+**
- **TailwindCSS** + **shadcn/ui-inspired** primitives (Sonoran desert palette, dark mode via `next-themes`)
- **Prisma ORM** + **PostgreSQL**
- **Auth.js / NextAuth v5** (credentials provider + JWT sessions)
- **OpenNext / Cloudflare Workers** production deployment
- **Vitest** unit tests for circulation and barcode logic

## Quick start (local)

```bash
# One-command bootstrap (Docker db preferred; falls back to native Postgres on 5432)
npm run local:setup
npm run dev
```

Or manually:

```bash
cp .env.example .env
# edit AUTH_SECRET (Docker: DATABASE_URL port 5433; native Postgres: 5432)

docker compose up -d db   # skip if using native Postgres

npx prisma migrate deploy
npm run db:seed

npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Demo credentials (**development seed only** — see [docs/local-development.md](docs/local-development.md)):

**Windows:** generate `AUTH_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. If Postgres on port 5432 is already in use, keep `docker-compose.yml` db mapping at `5433:5432` and set `DATABASE_URL` to `localhost:5433` as in `.env.example`.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@cacss.library` | `cacss-demo` |
| Librarian | `librarian@cacss.library` | `cacss-demo` |
| Member | `member@cacss.library` | `cacss-demo` |

## Docker (app + database)

```bash
export AUTH_SECRET="$(openssl rand -base64 32)"
docker compose up --build
```

The web container runs `prisma migrate deploy` before `npm run start`.

## Cloudflare Workers (live preview)

This app can deploy to Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare).

**You need:**

1. A Cloudflare account + [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) (`Workers Scripts: Edit`)
2. A hosted PostgreSQL database (e.g. [Neon](https://neon.tech) free tier) — run `npx prisma migrate deploy` (do **not** run demo seed in production)
3. Secrets: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`

**Deploy from your machine:**

```bash
npm ci
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export DATABASE_URL="postgresql://..."
export AUTH_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
export AUTH_TRUST_HOST="true"
npm run deploy
```

Your app will be at `https://cacss-library.<your-subdomain>.workers.dev`.

**Or use GitHub Actions:** add repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, `AUTH_SECRET` — pushes to `main` run `.github/workflows/deploy-cloudflare.yml`.

**Or connect the repo in Cloudflare Dashboard:** Workers & Pages → Create → Import Git → set build command `npm run deploy` and the same env vars.

## Deployment notes

### Vercel (frontend)

1. Provision **PostgreSQL** (Neon, Supabase, RDS, etc.).
2. Set `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_TRUST_HOST=true`.
3. Build command: `prisma generate && next build`.
4. Run migrations from CI or a release phase: `prisma migrate deploy`.

Because this app uses **Node-only** libraries (`pdf-parse`, Prisma heavy queries), prefer **Vercel Node runtime** (not Edge) for routes touching imports/PDF parsing.

### Railway / Render / Fly.io

Use the included `Dockerfile` or a Node buildpack:

1. Attach a managed Postgres instance.
2. Inject the same env vars as `.env.example`.
3. Start command should include `prisma migrate deploy` before bootstrapping Next.

### Backups

- Enable **automated snapshots** on your Postgres provider (daily minimum).
- Export quarterly CSV dumps via Prisma Studio (`npm run db:studio`) or `pg_dump`.
- Store digitized PDFs / scans on **object storage** (S3-compatible) — local `Attachment.storageKey` is ready to map to presigned URLs.

## Architecture highlights

- **Checkout desk** (`/checkout`) — multi-book basket, member search, quick add member, idempotent returns
- **Public catalog** (`/catalog`) — member-friendly browse; advanced filters for staff
- **Member account** (`/account`) — own loans and profile
- **Rare protections** — shorter loan timers, admin approval queue (`/approvals`)
- **Imports** — CSV/Excel preview, batch tracking, duplicate detection, CSV injection protection
- **Scan desk** (`/scan`) — UPC/ISBN lookup (Open Library + Google Books)
- **Staff dashboard** — overdue loans, quick actions, import history

See [docs/](docs/) for detailed guides.

## AI-ready hooks (future)

Attachment kinds (`PDF_SCAN`, `DIGITAL_ARCHIVE`), genus facets, and importer staging tables set you up for OCR pipelines, semantic search, duplicate-title clustering, and conversational librarian assistants without rewriting the catalog core.

## Offline PDF inventories

Your club PDF exports (Periodicals / Journals / Book lists) can be:

1. Exported to CSV/Excel from Acrobat or parsed externally, then uploaded via **Imports**.
2. Previewed directly as text via **PDF preview** when the file still contains selectable text.

Fully scanned image PDFs will need an OCR pass — architect that as a worker service writing back into `Attachment` + searchable tables.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Turbopack dev server on **port 3001** |
| `npm run build` / `npm run start` | Production bundle |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run deploy` | OpenNext build + Cloudflare deploy |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Demo data (**dev only**) |

## License

This repository was generated for CACSS operational planning — confirm licensing with your club officers before public redistribution.
