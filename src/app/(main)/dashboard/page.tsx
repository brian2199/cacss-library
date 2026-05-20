import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();

  const [
    items,
    copies,
    activeLoans,
    overdueLoans,
    rareItems,
    missingCopies,
    recentItems,
    categories,
    donorRowsRaw,
    popularLoansRaw,
  ] = await Promise.all([
    prisma.item.count(),
    prisma.itemCopy.count(),
    prisma.loan.count({
      where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
    }),
    prisma.loan.count({
      where: { status: "ACTIVE", dueDate: { lt: now } },
    }),
    prisma.item.count({ where: { OR: [{ rareProtected: true }, { rarityScore: { gte: 8 } }] } }),
    prisma.itemCopy.count({ where: { missing: true } }),
    prisma.item.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { category: true },
    }),
    prisma.category.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.itemCopy.groupBy({
      by: ["donorId"],
      _count: true,
      where: { donorId: { not: null } },
    }),
    prisma.loan.groupBy({
      by: ["itemCopyId"],
      _count: true,
      where: { status: "RETURNED" },
    }),
  ]);

  const popularLoans = [...popularLoansRaw]
    .sort((a, b) => b._count - a._count)
    .slice(0, 5);

  const donorRows = [...donorRowsRaw]
    .sort((a, b) => b._count - a._count)
    .slice(0, 8);

  const donorDetails =
    donorRows.length > 0
      ? await prisma.donor.findMany({
          where: { id: { in: donorRows.map((d) => d.donorId!) } },
        })
      : [];

  const donorMap = Object.fromEntries(donorDetails.map((d) => [d.id, d.name]));

  const popularCopyIds = popularLoans.map((p) => p.itemCopyId);
  const popularCopies =
    popularCopyIds.length > 0
      ? await prisma.itemCopy.findMany({
          where: { id: { in: popularCopyIds } },
          include: { item: true },
        })
      : [];
  const popularMap = Object.fromEntries(
    popularCopies.map((c) => [c.id, c.item.title]),
  );

  const statTiles = [
    { label: "Titles cataloged", value: items, hint: "Works-level records" },
    { label: "Physical copies", value: copies, hint: "Duplicates tracked" },
    { label: "Active loans & holds", value: activeLoans, hint: "Includes rare approvals" },
    { label: "Overdue timers", value: overdueLoans, hint: "Needs volunteer outreach" },
    { label: "Rare watchlist", value: rareItems, hint: "Protected posture" },
    { label: "Missing copies", value: missingCopies, hint: "Accountability flags" },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Stewardship dashboard
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
            Desert archive health
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Snapshot tuned for volunteers: circulation pressure, fragile volumes, donor generosity, and category balance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/catalog">Public catalog</Link>
          </Button>
          <Button asChild>
            <Link href="/checkout">Checkout desk</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statTiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader className="pb-2">
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="font-[family-name:var(--font-display)] text-3xl">
                {tile.value.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{tile.hint}</CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recently added titles</CardTitle>
            <CardDescription>Sorted by ingest timestamp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0">
                <div>
                  <Link href={`/catalog/${item.id}`} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {item.category?.name ?? "Uncategorized"}
                  </p>
                </div>
                <Badge variant="outline">{item.format.replaceAll("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Most circulated returns</CardTitle>
            <CardDescription>Historical checkout counts by copy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {popularLoans.map((row) => (
              <div key={row.itemCopyId} className="flex items-center justify-between">
                <span className="text-sm">{popularMap[row.itemCopyId] ?? row.itemCopyId}</span>
                <Badge variant="secondary">{row._count} returns</Badge>
              </div>
            ))}
            {popularLoans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No returns logged yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category distribution</CardTitle>
            <CardDescription>Where shelving attention concentrates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between text-sm">
                <span>{cat.name}</span>
                <span className="text-muted-foreground">{cat._count.items} titles</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Donor generosity</CardTitle>
            <CardDescription>Counted by copies attributed to donors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {donorRows.map((row) => (
              <div key={row.donorId ?? "unknown"} className="flex items-center justify-between text-sm">
                <span>{row.donorId ? donorMap[row.donorId] ?? "Donor" : "Unknown"}</span>
                <Badge variant="outline">{row._count} copies</Badge>
              </div>
            ))}
            {donorRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No donor-linked copies yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
