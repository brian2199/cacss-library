import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildItemWhere, type CatalogSearchParams } from "@/lib/catalog-where";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemProtectionBadges } from "@/components/item-badges";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const sp = await searchParams;
  const where = buildItemWhere(sp);

  const items = await prisma.item.findMany({
    where,
    orderBy: [{ title: "asc" }],
    include: {
      category: true,
      authors: { include: { author: true }, orderBy: { sortOrder: "asc" } },
      copies: true,
    },
    take: 80,
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Society catalog
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Search rare references, youth shelves, convention guides, and archival folders.
          Try genus names like Haworthia, filters for signed editions, or decade facets such as{" "}
          <kbd className="rounded bg-muted px-1">1950s</kbd>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Smart filters</CardTitle>
          <CardDescription>
            Server-side filters pair with fuzzy matching on titles, authors, tags, and botanical genera.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4" method="get" action="/catalog">
            <div className="md:col-span-2">
              <label className="sr-only" htmlFor="q">
                Search
              </label>
              <Input
                id="q"
                name="q"
                placeholder="Titles, authors, genus, tags…"
                defaultValue={sp.q ?? ""}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="decade">
                Decade
              </label>
              <Input
                id="decade"
                name="decade"
                placeholder="1950s"
                defaultValue={sp.decade ?? ""}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="format">
                Format
              </label>
              <select
                id="format"
                name="format"
                defaultValue={sp.format ?? "all"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All formats</option>
                <option value="BOOK">Books</option>
                <option value="JOURNAL">Journals</option>
                <option value="MAGAZINE">Magazines</option>
                <option value="DVD">DVDs</option>
                <option value="CONVENTION_GUIDE">Convention guides</option>
                <option value="YOUTH_BOOK">Youth books</option>
                <option value="REFERENCE_MATERIAL">Reference</option>
                <option value="ARCHIVAL_COLLECTION">Archival</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-4 md:col-span-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="referenceOnly" value="1" defaultChecked={sp.referenceOnly === "1"} />
                Reference only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="signed" value="1" defaultChecked={sp.signed === "1"} />
                Signed editions
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="fragile" value="1" defaultChecked={sp.fragile === "1"} />
                Fragile
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="rare" value="1" defaultChecked={sp.rare === "1"} />
                Rare / protected
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="missing" value="1" defaultChecked={sp.missing === "1"} />
                Missing copies exist
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="youth" value="1" defaultChecked={sp.youth === "1"} />
                Youth shelf
              </label>
            </div>
            <div className="md:col-span-4 flex gap-2">
              <Button type="submit">Apply</Button>
              <Button type="reset" variant="outline" asChild>
                <Link href="/catalog">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {items.length === 0 ? (
          <p className="text-muted-foreground">No matches yet — widen your search.</p>
        ) : null}
        {items.map((item) => {
          const missingCopy = item.copies.some((c) => c.missing);
          return (
            <Card key={item.id} className="shadow-soft transition hover:shadow-card">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="font-[family-name:var(--font-display)] text-xl">
                    <Link href={`/catalog/${item.id}`} className="hover:underline">
                      {item.title}
                    </Link>
                  </CardTitle>
                  {item.subtitle ? (
                    <CardDescription>{item.subtitle}</CardDescription>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.authors.map((ia) => ia.author.displayName).join(", ")}
                    {item.publicationYear ? ` · ${item.publicationYear}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{item.format.replaceAll("_", " ")}</Badge>
                    {item.category ? (
                      <Badge variant="secondary">{item.category.name}</Badge>
                    ) : null}
                    {missingCopy ? <Badge variant="destructive">Missing copy tracked</Badge> : null}
                  </div>
                  <div className="mt-3">
                    <ItemProtectionBadges item={item} />
                  </div>
                  {item.botanicalGenera.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.botanicalGenera.map((g) => (
                        <Badge key={g} variant="sage">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button asChild variant="outline">
                  <Link href={`/catalog/${item.id}`}>Open record</Link>
                </Button>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
