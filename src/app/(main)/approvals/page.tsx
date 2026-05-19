import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RareApprovalRow } from "@/components/rare-approval-row";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  await requireRole(["ADMIN"]);

  const pending = await prisma.loan.findMany({
    where: { status: "PENDING_RARE_APPROVAL" },
    orderBy: { checkedOutAt: "desc" },
    include: {
      memberProfile: { include: { user: true } },
      itemCopy: { include: { item: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Rare circulation
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Approval queue
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Signed editions, archival posture, and conservation flags pause circulation until an admin blesses the loan timer.
        </p>
      </div>

      <div className="space-y-4">
        {pending.map((loan) => (
          <Card key={loan.id}>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>
                  <Link href={`/catalog/${loan.itemCopy.item.id}`} className="hover:underline">
                    {loan.itemCopy.item.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  Requested for{" "}
                  <strong>{loan.memberProfile.user.name ?? loan.memberProfile.user.email}</strong>
                  {" · "}
                  barcode {loan.itemCopy.barcode ?? "n/a"}
                </CardDescription>
              </div>
              <RareApprovalRow loanId={loan.id} />
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Rare loan window defaults to {loan.itemCopy.item.loanDaysRare} days once approved.
            </CardContent>
          </Card>
        ))}
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Queue is clear.</p>
        ) : null}
      </div>
    </div>
  );
}
