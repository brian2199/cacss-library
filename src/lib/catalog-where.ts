import { ItemFormat, type Prisma } from "@prisma/client";
import { digitsOnly, extractIsbnCandidates } from "@/lib/barcode";

export type CatalogSearchParams = {
  q?: string;
  barcode?: string;
  format?: string;
  decade?: string;
  referenceOnly?: string;
  signed?: string;
  fragile?: string;
  rare?: string;
  missing?: string;
  youth?: string;
};

export function buildItemWhere(
  raw: CatalogSearchParams,
): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = {};
  const and: Prisma.ItemWhereInput[] = [];

  const barcode = raw.barcode?.trim();
  if (barcode) {
    const isbnCandidates = extractIsbnCandidates(barcode);
    const matchOr: Prisma.ItemWhereInput[] = [
      {
        copies: {
          some: { barcode: { equals: barcode, mode: "insensitive" } },
        },
      },
    ];
    for (const isbn of isbnCandidates) {
      matchOr.push({ isbn: { equals: isbn } });
    }
    const d = digitsOnly(barcode);
    if (d.length >= 10) {
      matchOr.push({ isbn: { equals: d } });
    }
    and.push({ OR: matchOr });
  }

  if (raw.missing === "1") {
    and.push({ copies: { some: { missing: true } } });
  }

  const q = raw.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { subtitle: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { isbn: { contains: q, mode: "insensitive" } },
        {
          authors: {
            some: {
              author: {
                OR: [
                  { displayName: { contains: q, mode: "insensitive" } },
                  { normalizedName: { contains: q.toLowerCase() } },
                ],
              },
            },
          },
        },
        { tags: { has: q } },
        { botanicalGenera: { has: q } },
      ],
    });
  }

  if (and.length === 1) {
    Object.assign(where, and[0]);
  } else if (and.length > 1) {
    where.AND = and;
  }

  if (raw.format && raw.format !== "all") {
    where.format = raw.format as ItemFormat;
  }

  const decade = raw.decade?.trim();
  if (decade && /^\d{4}s$/.test(decade)) {
    const start = Number(decade.slice(0, 4));
    where.publicationYear = { gte: start, lte: start + 9 };
  }

  if (raw.referenceOnly === "1") where.referenceOnly = true;
  if (raw.signed === "1") where.signedEdition = true;
  if (raw.fragile === "1") where.fragile = true;
  if (raw.rare === "1") where.rareProtected = true;
  if (raw.youth === "1") where.format = ItemFormat.YOUTH_BOOK;

  return where;
}
