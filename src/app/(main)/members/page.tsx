import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  await requireRole(["ADMIN"]);

  const profiles = await prisma.memberProfile.findMany({
    include: {
      user: true,
      _count: {
        select: {
          loans: true,
          reservations: true,
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          People & privileges
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Members
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Borrowing history aggregates roll up to profiles for desk-side coaching.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>Synced with Auth.js users — roles gate destructive powers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Topics</TableHead>
                <TableHead className="text-right">Loans</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.user.name ?? "—"}</TableCell>
                  <TableCell>{p.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.user.role}</Badge>
                  </TableCell>
                  <TableCell>{p.membershipStatus}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {p.favoriteTopics.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">{p._count.loans}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
