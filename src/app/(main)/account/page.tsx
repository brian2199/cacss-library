import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { isLoanOverdue } from "@/lib/circulation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function MemberAccountPage() {
  const session = await requireSession();

  const profile = await prisma.memberProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,
      loans: {
        where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
        include: {
          itemCopy: {
            include: {
              item: {
                include: {
                  authors: { include: { author: true }, orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  const recentReturns = profile
    ? await prisma.loan.findMany({
        where: {
          memberProfileId: profile.id,
          status: "RETURNED",
        },
        include: {
          itemCopy: {
            include: { item: true },
          },
        },
        orderBy: { returnedAt: "desc" },
        take: 5,
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">My account</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          {session.user.name ?? session.user.email}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your loans and membership information. Contact a librarian to renew or report an issue.
        </p>
      </div>

      {!profile ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No member profile is linked to this account. Ask a librarian if you need borrowing access.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{profile.user.email}</p>
              {profile.phone ? <p>{profile.phone}</p> : null}
              <p className="text-muted-foreground">
                Status: {profile.membershipStatus.toLowerCase().replace("_", " ")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checked out ({profile.loans.length})</CardTitle>
              <CardDescription>Items currently on your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.loans.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing checked out.{" "}
                  <Link href="/catalog" className="font-medium text-primary underline-offset-4 hover:underline">
                    Browse the catalog
                  </Link>
                  .
                </p>
              ) : (
                profile.loans.map((loan) => {
                  const overdue = isLoanOverdue(loan);
                  const authors =
                    loan.itemCopy.item.authors.map((a) => a.author.displayName).join(", ") ||
                    "Unknown author";
                  return (
                    <div
                      key={loan.id}
                      className="flex flex-col gap-2 border-b pb-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <Link
                          href={`/catalog/${loan.itemCopy.item.id}`}
                          className="font-medium hover:underline"
                        >
                          {loan.itemCopy.item.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">{authors}</p>
                        {loan.status === "PENDING_RARE_APPROVAL" ? (
                          <Badge variant="bloom" className="mt-1">
                            Awaiting rare approval
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-sm">
                        <p className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                          Due {format(loan.dueDate, "MMM d, yyyy")}
                          {overdue ? " (overdue)" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {recentReturns.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Recently returned</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentReturns.map((loan) => (
                  <div key={loan.id} className="text-sm">
                    <span className="font-medium">{loan.itemCopy.item.title}</span>
                    {loan.returnedAt ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — returned {format(loan.returnedAt, "MMM d, yyyy")}
                      </span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
