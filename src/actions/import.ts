"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import {
  parseSpreadsheetBuffer,
  type ParsedImportRow,
  IMPORT_TEMPLATE_CSV,
} from "@/lib/import-rows";
import { digitsOnly } from "@/lib/barcode";
import { lookupBookMetadata } from "@/lib/book-lookup";

async function requireImporter() {
  const session = await auth();
  if (
    !session?.user?.id ||
    !["LIBRARIAN", "ADMIN"].includes(session.user.role)
  ) {
    throw new Error("Unauthorized");
  }
  return session;
}

function normalizeAuthor(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function findDuplicate(row: ParsedImportRow): Promise<string | null> {
  if (row.barcode?.trim()) {
    const copy = await prisma.itemCopy.findFirst({
      where: { barcode: { equals: row.barcode.trim(), mode: "insensitive" } },
      include: { item: { select: { title: true } } },
    });
    if (copy) return `Row ${row.rowNumber}: barcode already used on “${copy.item.title}”.`;
  }

  if (row.isbn?.trim()) {
    const item = await prisma.item.findFirst({
      where: { isbn: row.isbn.trim() },
    });
    if (item) return `Row ${row.rowNumber}: duplicate ISBN (${item.title}).`;
  } else if (row.publicationYear) {
    const item = await prisma.item.findFirst({
      where: {
        title: { equals: row.title.trim(), mode: "insensitive" },
        publicationYear: row.publicationYear,
      },
    });
    if (item) return `Row ${row.rowNumber}: duplicate title + year (${item.title}).`;
  }

  return null;
}

async function enrichRowFromLookup(row: ParsedImportRow): Promise<ParsedImportRow> {
  const lookupKey = row.upc ?? row.barcode ?? row.isbn;
  if (!lookupKey) return row;

  const needsLookup =
    !row.isbn ||
    !row.publicationYear ||
    row.authors.length === 1 && row.authors[0] === "Unknown";

  if (!needsLookup) return row;

  const key = lookupKey;

  const meta = await lookupBookMetadata(key);
  if (!meta) return row;

  return {
    ...row,
    title: row.title.length >= 3 ? row.title : meta.title,
    subtitle: row.subtitle ?? meta.subtitle,
    authors: row.authors[0] === "Unknown" && meta.authors.length ? meta.authors : row.authors,
    isbn: row.isbn ?? meta.isbn,
    publicationYear: row.publicationYear ?? meta.publicationYear,
    publisher: row.publisher ?? meta.publisher,
  };
}

async function createItemFromRow(row: ParsedImportRow, branchId: string, categoryId: string) {
  const authorLinks: { id: string }[] = [];
  for (const displayName of row.authors) {
    const normalizedName = normalizeAuthor(displayName);
    const author = await prisma.author.upsert({
      where: { normalizedName },
      update: {},
      create: { normalizedName, displayName },
    });
    authorLinks.push(author);
  }

  const barcode =
    row.barcode?.trim() ||
    (row.upc ? digitsOnly(row.upc) : null) ||
    `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  await prisma.item.create({
    data: {
      title: row.title.trim(),
      subtitle: row.subtitle?.trim() || null,
      publicationYear: row.publicationYear ?? undefined,
      publisher: row.publisher?.trim() || null,
      format: row.format,
      isbn: row.isbn?.trim() || null,
      notes: row.notes?.trim() || null,
      branchId,
      categoryId,
      copies: {
        create: {
          copyNumber: row.copyNumber,
          barcode,
        },
      },
      authors: {
        create: authorLinks.map((a, idx) => ({
          authorId: a.id,
          sortOrder: idx,
        })),
      },
    },
  });
}

export async function getImportTemplateCsv(): Promise<string> {
  await requireImporter();
  return IMPORT_TEMPLATE_CSV;
}

/** Preview parsed rows without writing to the database. */
export async function previewSpreadsheet(formData: FormData) {
  await requireImporter();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Attach a file.");

  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = parseSpreadsheetBuffer(buf, file.name);

  return {
    filename: parsed.filename,
    sheetName: parsed.sheetName,
    headers: parsed.headers,
    skippedEmpty: parsed.skippedEmpty,
    preview: parsed.rows.slice(0, 25).map((r) => ({
      row: r.rowNumber,
      title: r.title,
      authors: r.authors.join("; "),
      year: r.publicationYear,
      isbn: r.isbn,
      upc: r.upc,
      barcode: r.barcode,
      format: r.format,
    })),
    totalRows: parsed.rows.length,
  };
}

export type ImportSpreadsheetResult = {
  created: number;
  skippedDup: number;
  skippedEmpty: number;
  errors: string[];
};

/** Flexible CSV / Excel ingest with UPC columns, preview support, and per-row errors. */
export async function importSpreadsheetBuffer(
  formData: FormData,
): Promise<ImportSpreadsheetResult> {
  const session = await requireImporter();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Attach a file.");

  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = parseSpreadsheetBuffer(buf, file.name);

  const branch = await prisma.branch.findFirst();
  if (!branch) throw new Error("Run seed before importing.");

  const inboxCategory =
    (await prisma.category.findUnique({ where: { slug: "imports-inbox" } })) ??
    (await prisma.category.create({
      data: {
        name: "Imports inbox",
        slug: "imports-inbox",
        description: "Rows staged from CSV / Excel until taxonomists refine categories.",
      },
    }));

  let created = 0;
  let skippedDup = 0;
  const errors: string[] = [];

  for (const rawRow of parsed.rows) {
    try {
      const row = await enrichRowFromLookup(rawRow);
      const dupReason = await findDuplicate(row);
      if (dupReason) {
        skippedDup++;
        errors.push(dupReason);
        continue;
      }
      await createItemFromRow(row, branch.id, inboxCategory.id);
      created++;
    } catch (err) {
      errors.push(
        `Row ${rawRow.rowNumber}: ${err instanceof Error ? err.message : "Import failed."}`,
      );
    }
  }

  await auditLog({
    actorId: session.user.id,
    action: "IMPORT",
    entityType: "Item",
    summary: `Imported ${created} rows, skipped ${skippedDup} duplicates`,
    payload: { filename: file.name, errorCount: errors.length },
  });

  revalidatePath("/catalog");
  revalidatePath("/dashboard");

  return {
    created,
    skippedDup,
    skippedEmpty: parsed.skippedEmpty,
    errors: errors.slice(0, 50),
  };
}

export async function previewPdfText(formData: FormData) {
  await requireImporter();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Attach a PDF.");

  const pdfParse = (await import("pdf-parse")).default;
  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = await pdfParse(buf);
  const lines = parsed.text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 80);

  return { lines, pages: parsed.numpages };
}
