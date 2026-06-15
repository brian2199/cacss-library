import Link from "next/link";
import { CacssLogo } from "@/components/cacss-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-secondary/40 via-background to-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23154a35' stroke-width='1'%3E%3Cpath d='M60 100c8-25 20-45 30-55M35 75c12 8 28 12 40 10M70 40c-12 5-22 18-28 35'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-8">
        <CacssLogo
          href="/"
          size="lg"
          showLibraryLabel
          tagline="Central Arizona Cactus & Succulent Society"
          priority
        />
        <Button asChild>
          <Link href="/login">Volunteer sign in</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 pb-24 pt-4 md:grid-cols-[1.15fr_0.85fr] md:items-start">
        <section className="space-y-6">
          <h1 className="font-[family-name:var(--font-display)] text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            A botanical archive built for fragile, rare, and beloved desert
            titles.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Track signed collector editions, convention guides, journals, DVDs,
            youth shelves, and archival drawers—with protections worthy of
            irreplaceable society holdings.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">Open librarian workspace</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/catalog">Browse catalog</Link>
            </Button>
          </div>
        </section>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-display)] text-xl">
                Rare book safeguards
              </CardTitle>
              <CardDescription>
                Reference-only routing, shorter loan windows, approval queues,
                condition history, and borrower traceability.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-display)] text-xl">
                Desert-smart discovery
              </CardTitle>
              <CardDescription>
                Genus-aware filters, fuzzy title search, tags, decades, and an
                importer tuned for legacy spreadsheets and PDF exports.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Attach scanned PDFs today; OCR and semantic search hooks are
              scaffolded for tomorrow&apos;s digitization push.
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
