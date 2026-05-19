# CACSS Library

Modern library operations console for the **Central Arizona Cactus & Succulent Society (CACSS)** — tuned for rare botanical books, society journals, DVDs, youth shelves, convention guides, and archival folders.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **TailwindCSS** + **shadcn/ui-inspired** primitives (Sonoran desert palette, dark mode via `next-themes`)
- **Prisma ORM** + **PostgreSQL**
- **Auth.js / NextAuth v5** (credentials provider + JWT sessions)
- **TanStack Query** for client caching utilities
- **Recharts** reporting
- **CSV / Excel / PDF text preview** import pathways (PDF OCR flagged as a future phase)

## Quick start (local)

```bash
cp .env.example .env
# edit DATABASE_URL + AUTH_SECRET

# Start Postgres (or use Docker Compose db service only)
docker compose up -d db

npx prisma migrate deploy   # or: npx prisma db push
npm run db:seed             # prisma db seed

npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo credentials (after seed):

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

- **Public catalog** (`/catalog`) — fine-grained filters (genus, rarity, signed, decade, missing copies, reference-only, youth shelf).
- **Rare protections** — shorter loan timers, admin approval queue (`/approvals`), acknowledgement tracking, visual badges.
- **Imports** — CSV/Excel normalization with duplicate detection on ISBN or title+year; PDF preview extracts embedded text (scanned stacks await OCR microservices).
- **Scan desk + QR labels** — `/scan` jumps straight into barcode-filtered catalog views; `/labels` prints authenticated PNG QR tiles.
- **Audit trail** — `AuditLog` captures circulation + imports (expand with middleware hooks as needed).

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
| `npm run dev` | Turbopack dev server |
| `npm run build` / `npm run start` | Production bundle |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Loads desert-themed demo inventory |

## License

This repository was generated for CACSS operational planning — confirm licensing with your club officers before public redistribution.
