# CACSS Library — Agent Guide

## Project

Specialty lending library for the Central Arizona Cactus & Succulent Society.

- **Repo:** https://github.com/brian2199/cacss-library
- **Dev URL:** http://localhost:3001
- **DB (Docker):** host port **5433** → container 5432

## Stack

Next.js 15 · TypeScript · Prisma 6 · PostgreSQL · Auth.js (credentials/JWT) · Tailwind · OpenNext/Cloudflare

## Key concepts

| Concept | Model | Notes |
|---------|--------|-------|
| Title | `Item` | Bibliographic record; ISBN lives here |
| Copy | `ItemCopy` | Physical unit; unique `barcode` |
| Loan | `Loan` | Active loan = source of truth for checked-out state |
| Member | `User` + `MemberProfile` | Borrowing identity |

Do **not** confuse ISBN/UPC (title identifier) with copy barcodes.

## Commands

```bash
npm ci
docker compose up -d db
npx prisma migrate deploy
npm run db:seed          # dev only; blocked in production without ALLOW_DEMO_SEED
npm run dev              # port 3001
npm test
npm run typecheck
npm run build
npx opennextjs-cloudflare build
```

## Roles

- **ADMIN** — members, settings, approvals, all librarian functions
- **LIBRARIAN** — catalog, checkout, imports, scan
- **MEMBER** — `/catalog`, `/account` only (staff routes blocked in middleware)

## Circulation

Central logic: `src/lib/circulation.ts`

- Multi-copy checkout: `checkoutCopiesTransaction()` — all-or-nothing
- Returns: `returnCopyByBarcodeTransaction()` — idempotent

Checkout desk: `/checkout` — basket workflow

## Imports

`src/actions/import.ts` + `src/lib/import-rows.ts`

Preview before commit. `ImportBatch` tracks file hash for idempotency.

## Production safety

- Never commit `.env` or secrets
- Demo seed password `cacss-demo` is **development only**
- Production deploy needs hosted Postgres + Cloudflare secrets (see `docs/production-deployment.md`)

## Do not

- Edit generated Prisma client directly
- Reset production databases
- Force-push shared branches
- Claim Cloudflare deploy succeeded without verified live URL
