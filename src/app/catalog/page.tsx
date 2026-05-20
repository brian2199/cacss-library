import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildItemWhere, type CatalogSearchParams } from "@/lib/catalog-where";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemProtectionBadges } from "@/components/item-badges";
import { CatalogSearchForm } from "@/components/catalog-search-form";
import { formatLabel, isSpecialItem } from "@/lib/item-display";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const staff =
    session?.user?.role === "LIBRARIAN" || session?.user?.role === "ADMIN";

  const hasQuery =
    Boolean(sp.q?.trim()) ||
    Boolean(sp.barcode?.trim()) ||
    Boolean(sp.decade?.trim()) ||
    sp.referenceOnly === "1" ||
    sp.signed === "1" ||
    sp.fragile === "1" ||
    sp.rare === "1" ||
    sp.missing === "1" ||
    sp.youth === "1";

  const where = buildItemWhere({
    ...sp,
    format: sp.format ?? (hasQuery ? "all" : "BOOK"),
  });

  const items = await prisma.item.findMany({
    where,
    orderBy: [{ title: "asc" }],
    include: {
      category: true,
      authors: { include: { author: true }, orderBy: { sortOrder: "asc" } },
      copies: {
        include: {
          loans: {
            where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
          },
        },
      },
    },
    take: 80,
  });

  const barcodeScan = sp.barcode?.trim();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Library catalog
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Search books by title or author. Most of our collection is regular circulating material —
          use advanced filters only when you need rare or specialty titles.
        </p>
      </div>

      {barcodeScan ? (
        <AlertBanner barcode={barcodeScan} count={items.length} />
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <CatalogSearchForm sp={sp} showAdvanced={staff} />
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {items.length} result{items.length === 1 ? "" : "s"}
        {items.length >= 80 ? " (showing first 80)" : ""}
      </p>

      <div className="grid gap-3">
        {items.length === 0 ? (
          <p className="text-muted-foreground">No matches — try a shorter search or All types.</p>
        ) : null}
        {items.map((item) => {
          const available = item.copies.filter((c) => !c.missing && c.loans.length === 0).length;
          const total = item.copies.filter((c) => !c.missing).length;
          const special = isSpecialItem(item);

          return (
            <Card key={item.id} className="shadow-soft transition hover:shadow-card">
              <CardHeader className="flex flex-row items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="font-[family-name:var(--font-display)] text-lg leading-snug">
                    <Link href={`/catalog/${item.id}`} className="hover:underline">
                      {item.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {item.authors.map((ia) => ia.author.displayName).join(", ") || "Unknown author"}
                    {item.publicationYear ? ` · ${item.publicationYear}` : ""}
                  </CardDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    {item.format !== "BOOK" ? (
                      <Badge variant="outline">{formatLabel(item.format)}</Badge>
                    ) : null}
                    {total > 0 ? (
                      <span
                        className={
                          available > 0
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {available > 0
                          ? `${available} of ${total} available`
                          : "All copies out or unavailable"}
                      </span>
                    ) : null}
                  </div>
                  {special ? (
                    <div className="mt-2">
                      <ItemProtectionBadges item={item} />
                    </div>
                  ) : null}
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={`/catalog/${item.id}`}>Details</Link>
                </Button>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AlertBanner({ barcode, count }: { barcode: string; count: number }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      Barcode scan: <code className="font-mono text-xs">{barcode}</code>
      {count === 0 ? " — no match in catalog." : ` — ${count} match${count === 1 ? "" : "es"}.`}
    </div>
  );
}
