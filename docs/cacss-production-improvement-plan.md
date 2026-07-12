# CACSS Library — Production Improvement Plan

## Architecture

- **Next.js 15** App Router with server components and server actions
- **PostgreSQL** via Prisma ORM
- **Auth.js / NextAuth v5** JWT credentials sessions
- **OpenNext + Cloudflare Workers** production target
- **Open Library / Google Books** optional metadata enrichment

## Data model (core)

| Concept | Model | Notes |
|--------|--------|-------|
| Bibliographic title | `Item` | Work-level record; ISBN on title |
| Physical copy | `ItemCopy` | Unique `barcode` per copy when assigned |
| Member | `User` + `MemberProfile` | Borrowing identity |
| Loan | `Loan` | One active loan per copy; status is source of truth |
| Import batch | `ImportBatch` | File hash + row counts for idempotency audit |

**Important:** A scanned UPC/ISBN identifies a *title*; a CACSS copy barcode identifies a *physical copy*.

## Route map

| Route | Audience | Purpose |
|-------|----------|---------|
| `/login` | Public | Sign in |
| `/catalog` | Public/members | Browse & search |
| `/account` | Members | Own loans & profile |
| `/checkout` | Librarian/Admin | Circulation desk (basket checkout) |
| `/scan` | Staff | Add titles/copies via barcode |
| `/imports` | Staff | CSV/XLSX import with preview |
| `/dashboard` | Staff | Operational command center |
| `/loans` | Staff (members via `/account`) | Loan management |

## Implemented in this pass

### Priority 1 — Circulation
- Multi-item checkout **basket** with transactional commit
- Idempotent **returns** (already-returned copies show notice)
- Centralized `src/lib/circulation.ts` rules
- Member search with overdue context; duplicate member warning on create
- Production-safe member passwords (random; no shared demo password in prod UI)

### Priority 1 — Barcodes
- Extended validation (ISBN-10/13, UPC-A, internal CACSS)
- `classifyBarcode()` normalized result type
- Scan deduplication in checkout UI

### Priority 1 — Imports
- `ImportBatch` model with file SHA-256 hash
- 5 MB upload limit; extension allowlist
- CSV formula injection sanitization on import cells
- Duplicate file warning on preview

### Priority 1 — UX & roles
- Staff dashboard with actionable links
- Member `/account` page
- Role-aware navigation and login redirects
- Logo rendering without destructive dark-mode invert

### Priority 3 — Engineering
- Vitest unit tests (barcode, circulation, CSV sanitize)
- CI workflow (lint, typecheck, test, build, OpenNext)
- Node 22 via `.nvmrc` and `engines`
- Production seed guard (`ALLOW_DEMO_SEED`)

## Database migration

`20260712050000_import_batch_and_loan_indexes` — adds `ImportBatch`, loan query indexes. **Non-destructive.**

## Verification strategy

- Unit: barcode, circulation eligibility, CSV sanitization
- Manual: checkout basket, return rescan, member create, import preview
- CI: full build + OpenNext bundle

## Risks & follow-ups

- Cloudflare live deploy requires user API token + hosted Postgres (Neon recommended)
- Prisma on Workers may need Neon serverless driver or Hyperdrive at scale
- E2E browser tests not yet added (Playwright candidate)
- Rate limiting on login best implemented via Cloudflare WAF/rules
