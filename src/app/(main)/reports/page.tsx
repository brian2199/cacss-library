import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryDistributionChart } from "@/components/category-distribution-chart";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireRole(["LIBRARIAN", "ADMIN"]);

  const categories = await prisma.category.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });

  const chartData = categories.map((c) => ({
    name: c.name,
    count: c._count.items,
  }));

  const [inventory, checkedOut, rareCount] = await Promise.all([
    prisma.item.count(),
    prisma.loan.count({
      where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
    }),
    prisma.item.count({
      where: {
        OR: [{ rareProtected: true }, { requiresRareApproval: true }],
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Steward analytics
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Reporting dashboard
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Charts mirror Board-ready KPIs: shelved breadth, circulation tension, and rare protections.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Titles</CardTitle>
            <CardDescription>Works indexed</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{inventory}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>In circulation</CardTitle>
            <CardDescription>Active + pending rare</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{checkedOut}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rare posture</CardTitle>
            <CardDescription>Titles flagged rare / dual approval</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{rareCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category distribution</CardTitle>
          <CardDescription>
            Visual companion to the dashboard tables — export-ready for newsletter graphs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryDistributionChart data={chartData} />
        </CardContent>
      </Card>
    </div>
  );
}
