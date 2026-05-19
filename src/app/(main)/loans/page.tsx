import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoanDeskActions } from "@/components/loan-desk-actions";
import { acknowledgeDueDate } from "@/actions/loans";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const session = await requireSession();
  const now = new Date();

  const memberFilter =
    session.user.role === "MEMBER"
      ? { memberProfile: { userId: session.user.id } }
      : {};

  const active = await prisma.loan.findMany({
    where: {
      ...memberFilter,
      status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] },
    },
    orderBy: { dueDate: "asc" },
    include: {
      memberProfile: { include: { user: true } },
      itemCopy: { include: { item: true } },
    },
  });

  const overdue = active.filter(
    (l) => l.status === "ACTIVE" && l.dueDate < now,
  );

  async function ack(formData: FormData) {
    "use server";
    const id = formData.get("loanId")?.toString();
    if (id) await acknowledgeDueDate(id);
  }

  const staff = ["LIBRARIAN", "ADMIN"].includes(session.user.role);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Circulation
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Loans & holds
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Desk-first workflow with overdue highlighting, rare approvals, and accountability acknowledgements.
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({active.length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({overdue.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-4 pt-4">
          {active.map((loan) => (
            <Card key={loan.id}>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-xl">
                    <Link href={`/catalog/${loan.itemCopy.item.id}`} className="hover:underline">
                      {loan.itemCopy.item.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    Borrower{" "}
                    <strong>{loan.memberProfile.user.name ?? loan.memberProfile.user.email}</strong>
                    {" · "}
                    Copy {loan.itemCopy.barcode ?? loan.itemCopy.copyNumber}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {loan.status === "PENDING_RARE_APPROVAL" ? (
                    <Badge variant="bloom">Needs admin approval</Badge>
                  ) : null}
                  {loan.status === "ACTIVE" && loan.dueDate < now ? (
                    <Badge variant="destructive">Overdue</Badge>
                  ) : (
                    <Badge variant="outline">
                      Due {loan.dueDate.toLocaleDateString()}
                    </Badge>
                  )}
                  {loan.dueDateAcknowledgedAt ? (
                    <Badge variant="secondary">Due date acknowledged</Badge>
                  ) : loan.status === "ACTIVE" ? (
                    <Badge variant="warn">Acknowledgement pending</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Renewals used {loan.renewalCount}/{loan.maxRenewals}. Rare titles renew only with desk approval.
                  </p>
                  {loan.status === "ACTIVE" &&
                  session.user.role === "MEMBER" &&
                  session.user.id === loan.memberProfile.user.id &&
                  !loan.dueDateAcknowledgedAt ? (
                    <form action={ack}>
                      <input type="hidden" name="loanId" value={loan.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        Acknowledge due date
                      </button>
                    </form>
                  ) : null}
                </div>
                {staff && loan.status === "ACTIVE" ? (
                  <LoanDeskActions
                    loanId={loan.id}
                    canRenew={
                      !loan.itemCopy.item.requiresRareApproval &&
                      !loan.itemCopy.item.rareProtected
                    }
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active loans.</p>
          ) : null}
        </TabsContent>
        <TabsContent value="overdue" className="space-y-4 pt-4">
          {overdue.map((loan) => (
            <Card key={loan.id} className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-lg">{loan.itemCopy.item.title}</CardTitle>
                <CardDescription>
                  {loan.memberProfile.user.name ?? loan.memberProfile.user.email} · due{" "}
                  {loan.dueDate.toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              {staff ? (
                <CardContent>
                  <LoanDeskActions
                    loanId={loan.id}
                    canRenew={
                      !loan.itemCopy.item.requiresRareApproval &&
                      !loan.itemCopy.item.rareProtected
                    }
                  />
                </CardContent>
              ) : null}
            </Card>
          ))}
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing overdue right now.</p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
