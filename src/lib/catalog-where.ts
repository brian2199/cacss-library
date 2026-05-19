import { ItemFormat, type Prisma } from "@prisma/client";

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

  const barcode = raw.barcode?.trim();
  const copyFilters: Prisma.ItemCopyWhereInput[] = [];
  if (barcode) {
    copyFilters.push({
      barcode: { equals: barcode, mode: "insensitive" },
    });
  }
  if (raw.missing === "1") {
    copyFilters.push({ missing: true });
  }
  if (copyFilters.length === 1) {
    where.copies = { some: copyFilters[0] };
  } else if (copyFilters.length > 1) {
    where.copies = { some: { AND: copyFilters } };
  }

  const q = raw.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { subtitle: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
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
    ];
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
