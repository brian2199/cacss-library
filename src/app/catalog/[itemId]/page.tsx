import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ItemProtectionBadges } from "@/components/item-badges";
import { CopyCheckoutPanel } from "@/components/copy-checkout-panel";

export const dynamic = "force-dynamic";

export default async function CatalogItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const session = await auth();

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      category: true,
      branch: true,
      authors: { include: { author: true }, orderBy: { sortOrder: "asc" } },
      copies: {
        include: {
          shelfLocation: { include: { branch: true } },
          donor: true,
          loans: {
            where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
          },
          conditionLog: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { copyNumber: "asc" },
      },
      attachments: true,
    },
  });

  if (!item) notFound();

  const staff =
    session?.user?.role === "LIBRARIAN" || session?.user?.role === "ADMIN";

  const members = staff
    ? await prisma.memberProfile.findMany({
        include: { user: true },
        orderBy: { user: { name: "asc" } },
      })
    : [];

  const memberOptions = members.map((m) => ({
    id: m.id,
    label: `${m.user.name ?? m.user.email} · ${m.user.role}`,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Catalog detail
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
            {item.title}
          </h1>
          {item.subtitle ? (
            <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
              {item.subtitle}
            </p>
          ) : null}
        </div>
        <Link
          href="/catalog"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Back to catalog
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{item.format.replaceAll("_", " ")}</Badge>
        {item.category ? (
          <Badge variant="secondary">{item.category.name}</Badge>
        ) : null}
        {item.publicationYear ? (
          <Badge variant="secondary">{item.publicationYear}</Badge>
        ) : null}
        {item.branch ? <Badge variant="sage">{item.branch.name}</Badge> : null}
      </div>

      <ItemProtectionBadges item={item} />

      <Card>
        <CardHeader>
          <CardTitle>{staff ? "Bibliographic snapshot" : "About this title"}</CardTitle>
          {staff ? (
            <CardDescription>
              Stewardship metadata includes rarity posture and volunteer notes.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Authors</p>
            <p>{item.authors.map((a) => a.author.displayName).join(", ")}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Publisher {item.publicationYear ? `/ ${item.publicationYear}` : ""}
            </p>
            <p>
              {item.publisher ?? "—"}
              {item.bindingType ? ` · ${item.bindingType.replaceAll("_", " ")}` : ""}
            </p>
          </div>
          {!staff ? null : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  ISBN / pages
                </p>
                <p>
                  {item.isbn ?? "—"}
                  {item.pages ? ` · ${item.pages} pp.` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Est. value / rarity score
                </p>
                <p>
                  {item.estimatedValue ? `$${item.estimatedValue.toString()}` : "—"}
                  {` · score ${item.rarityScore}`}
                </p>
              </div>
            </>
          )}
          {item.botanicalGenera.length ? (
            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Subjects</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {item.botanicalGenera.map((g) => (
                  <Badge key={g} variant="outline">
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {staff ? (
            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Volunteer notes
              </p>
              <p className="text-sm">{item.notes ?? "No notes yet."}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{staff ? "Copies & circulation posture" : "Availability"}</CardTitle>
          <CardDescription>
            {staff
              ? "Missing or damaged copies stay visible for accountability."
              : item.referenceOnly
                ? "Reference use in the reading room — does not circulate."
                : "Contact a librarian to borrow available copies."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {item.copies.map((copy) => (
            <div key={copy.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {staff ? (
                    <>
                      <p className="font-medium">
                        Copy #{copy.copyNumber}{" "}
                        <span className="text-muted-foreground">
                          {copy.barcode ? `· ${copy.barcode}` : ""}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Shelf{" "}
                        {copy.shelfLocation
                          ? `${copy.shelfLocation.branch.name} · ${copy.shelfLocation.code}`
                          : "unassigned"}
                        {copy.donor ? ` · donor ${copy.donor.name}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {copy.shelfLocation
                        ? `Shelf ${copy.shelfLocation.label ?? copy.shelfLocation.code}`
                        : "Ask a librarian for shelf location"}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {copy.missing ? <Badge variant="destructive">Missing</Badge> : null}
                  {copy.damaged ? <Badge variant="warn">Damaged</Badge> : null}
                  {item.referenceOnly ? (
                    <Badge variant="secondary">Reference only</Badge>
                  ) : copy.loans.length ? (
                    <Badge variant="secondary">Checked out</Badge>
                  ) : copy.missing ? null : (
                    <Badge variant="outline">Available</Badge>
                  )}
                </div>
              </div>

              {staff &&
              !item.referenceOnly &&
              item.checkoutEligible &&
              !copy.missing &&
              copy.loans.length === 0 ? (
                <CopyCheckoutPanel copyId={copy.id} members={memberOptions} />
              ) : null}

              {staff && copy.conditionLog.length ? (
                <div>
                  <p className="text-sm font-semibold">Recent condition notes</p>
                  <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                    {copy.conditionLog.map((log) => (
                      <li key={log.id}>
                        <span className="text-foreground">{log.condition}</span>
                        {log.notes ? ` — ${log.notes}` : ""}{" "}
                        <span className="text-xs">
                          ({new Date(log.createdAt).toLocaleDateString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Separator />
            </div>
          ))}
        </CardContent>
      </Card>

      {staff ? (
        <Card>
          <CardHeader>
            <CardTitle>Digital attachments</CardTitle>
            <CardDescription>Cover scans and PDF surrogates for future OCR pipelines.</CardDescription>
          </CardHeader>
          <CardContent>
            {item.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {item.attachments.map((a) => (
                  <li key={a.id}>
                    <Badge variant="outline">{a.kind}</Badge> {a.filename}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!session ? (
        <p className="text-sm text-muted-foreground">
          Sign in as a volunteer to manage circulation from this screen.
        </p>
      ) : null}
    </div>
  );
}
