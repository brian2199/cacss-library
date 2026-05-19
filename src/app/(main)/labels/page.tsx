import { headers } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  await requireRole(["LIBRARIAN", "ADMIN"]);

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3001";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const [copies, members] = await Promise.all([
    prisma.itemCopy.findMany({
      orderBy: { updatedAt: "desc" },
      take: 24,
      include: { item: true },
    }),
    prisma.memberProfile.findMany({
      include: { user: true },
      orderBy: { user: { name: "asc" } },
      take: 12,
    }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Shelf-ready media
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          QR labels & member cards
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Encode deep links back into this catalog so mobile volunteers jump straight into circulation context.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Copy labels</CardTitle>
          <CardDescription>
            PNG tiles via authenticated API — print from browser & tape beside barcode stickers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {copies.map((copy) => {
            const targetUrl = copy.barcode
              ? `${baseUrl}/catalog?barcode=${encodeURIComponent(copy.barcode)}`
              : `${baseUrl}/catalog/${copy.item.id}`;
            const qrSrc = `/api/labels/qrcode?payload=${encodeURIComponent(targetUrl)}`;
            return (
              <div key={copy.id} className="rounded-xl border bg-card p-4 shadow-soft">
                <div className="flex gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    width={140}
                    height={140}
                    className="rounded-lg border bg-white p-1 dark:bg-white"
                    alt=""
                  />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold leading-snug">{copy.item.title}</p>
                    <p className="text-muted-foreground">
                      {copy.barcode ?? "No barcode"} · copy #{copy.copyNumber}
                    </p>
                    <Link href={`/catalog/${copy.item.id}`} className="text-xs text-primary underline">
                      Open record
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Member cards</CardTitle>
          <CardDescription>
            QR encodes mailto links for fast patron lookups — swap for RFID later without redesigning this screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const mail = `mailto:${m.user.email}`;
            const qrSrc = `/api/labels/qrcode?payload=${encodeURIComponent(mail)}`;
            return (
              <div key={m.id} className="rounded-xl border bg-card p-4 shadow-soft">
                <div className="flex gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    width={120}
                    height={120}
                    className="rounded-lg border bg-white p-1 dark:bg-white"
                    alt=""
                  />
                  <div className="text-sm">
                    <p className="font-semibold">{m.user.name ?? m.user.email}</p>
                    <p className="text-muted-foreground">{m.user.role}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
