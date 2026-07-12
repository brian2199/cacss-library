import Link from "next/link";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireRole(["LIBRARIAN", "ADMIN"]);
  const now = new Date();
  const dueSoonCutoff = addDays(now, 7);

  const [
    items,
    copies,
    activeLoans,
    overdueLoans,
    dueSoonLoans,
    missingCopies,
    recentItems,
    overdueList,
    recentImports,
    titlesMissingIsbn,
  ] = await Promise.all([
    prisma.item.count(),
    prisma.itemCopy.count(),
    prisma.loan.count({
      where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
    }),
    prisma.loan.count({
      where: { status: "ACTIVE", dueDate: { lt: now } },
    }),
    prisma.loan.count({
      where: { status: "ACTIVE", dueDate: { gte: now, lte: dueSoonCutoff } },
    }),
    prisma.itemCopy.count({ where: { missing: true } }),
    prisma.item.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { category: true },
    }),
    prisma.loan.findMany({
      where: { status: "ACTIVE", dueDate: { lt: now } },
      include: {
        memberProfile: { include: { user: true } },
        itemCopy: { include: { item: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.item.count({ where: { OR: [{ isbn: null }, { isbn: "" }] } }),
  ]);

  const statTiles = [
    { label: "Titles", value: items, href: "/catalog" },
    { label: "Copies", value: copies, href: "/catalog" },
    { label: "Out now", value: activeLoans, href: "/loans" },
    { label: "Overdue", value: overdueLoans, href: "/loans?filter=overdue" },
    { label: "Due within 7 days", value: dueSoonLoans, href: "/loans?filter=due-soon" },
    { label: "Missing copies", value: missingCopies, href: "/catalog?missing=1" },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Operations
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
            Library dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Live circulation and catalog health — every count links to the relevant workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/checkout">Checkout desk</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/checkout?tab=return">Returns</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/scan">Add books</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/imports">Import</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statTiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <CardDescription>{tile.label}</CardDescription>
                <CardTitle className="font-[family-name:var(--font-display)] text-3xl">
                  {tile.value.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue loans</CardTitle>
            <CardDescription>Needs volunteer outreach</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue loans.</p>
            ) : (
              overdueList.map((loan) => (
                <div key={loan.id} className="flex flex-col gap-1 border-b pb-3 text-sm last:border-b-0">
                  <span className="font-medium">{loan.itemCopy.item.title}</span>
                  <span className="text-muted-foreground">
                    {loan.memberProfile.user.name ?? loan.memberProfile.user.email} · due{" "}
                    {loan.dueDate.toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
            <Button asChild variant="link" className="px-0">
              <Link href="/loans">View all loans</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently added</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b pb-3 text-sm last:border-b-0">
                <Link href={`/catalog/${item.id}`} className="font-medium hover:underline">
                  {item.title}
                </Link>
                <Badge variant="outline">{item.format.replaceAll("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Catalog data gaps</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              {titlesMissingIsbn.toLocaleString()} titles missing ISBN — review during imports or
              cataloging.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent imports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentImports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No import batches yet.</p>
            ) : (
              recentImports.map((batch) => (
                <div key={batch.id} className="text-sm">
                  <span className="font-medium">{batch.filename}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {batch.createdCount} created, {batch.skippedCount} skipped ·{" "}
                    {batch.createdAt.toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
            <Button asChild variant="link" className="px-0">
              <Link href="/imports">Go to imports</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
