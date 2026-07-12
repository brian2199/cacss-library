"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import {
  parseSpreadsheetBuffer,
  type ParsedImportRow,
  IMPORT_TEMPLATE_CSV,
  MAX_IMPORT_FILE_BYTES,
  ALLOWED_IMPORT_EXTENSIONS,
} from "@/lib/import-rows";
import { digitsOnly } from "@/lib/barcode";
import { validateImportRow } from "@/lib/import-validate";
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

function validateUpload(file: File, buf: Buffer) {
  const lower = file.name.toLowerCase();
  if (!ALLOWED_IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new Error("Use CSV or Excel (.csv, .xlsx, .xls) only.");
  }
  if (buf.byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new Error(`File exceeds ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB limit.`);
  }
  if (file.name.includes("..") || file.name.includes("/") || file.name.includes("\\")) {
    throw new Error("Invalid filename.");
  }
}

function fileHash(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
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
    (row.authors.length === 1 && row.authors[0] === "Unknown");

  if (!needsLookup) return row;

  const meta = await lookupBookMetadata(lookupKey);
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

export type ImportPreviewResult = {
  filename: string;
  sheetName?: string;
  headers: string[];
  skippedEmpty: number;
  preview: Array<{
    row: number;
    title: string;
    authors: string;
    year?: number;
    isbn?: string;
    upc?: string;
    barcode?: string;
    format: string;
    validation?: "ok" | "warn" | "reject";
    message?: string;
  }>;
  totalRows: number;
  duplicateFileWarning?: string;
};

/** Preview parsed rows without writing to the database. */
export async function previewSpreadsheet(formData: FormData): Promise<ImportPreviewResult> {
  await requireImporter();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Attach a file.");

  const buf = Buffer.from(await file.arrayBuffer());
  validateUpload(file, buf);
  const parsed = parseSpreadsheetBuffer(buf, file.name);
  const hash = fileHash(buf);

  const prior = await prisma.importBatch.findFirst({
    where: { fileHash: hash, createdCount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
  });

  const preview = await Promise.all(
    parsed.rows.slice(0, 25).map(async (r) => {
      const dup = await findDuplicate(r);
      const validation = validateImportRow(r);
      const status = dup ? "reject" : validation.status;
      const message = dup ?? (validation.messages.length ? validation.messages.join("; ") : undefined);
      return {
        row: r.rowNumber,
        title: r.title,
        authors: r.authors.join("; "),
        year: r.publicationYear,
        isbn: r.isbn,
        upc: r.upc,
        barcode: r.barcode,
        format: r.format,
        validation: status as "ok" | "warn" | "reject",
        message,
      };
    }),
  );

  return {
    filename: parsed.filename,
    sheetName: parsed.sheetName,
    headers: parsed.headers,
    skippedEmpty: parsed.skippedEmpty,
    preview,
    totalRows: parsed.rows.length,
    duplicateFileWarning: prior
      ? `This exact file was imported on ${prior.createdAt.toLocaleDateString()} (${prior.createdCount} rows created). Re-import may skip duplicates.`
      : undefined,
  };
}

export type ImportSpreadsheetResult = {
  created: number;
  skippedDup: number;
  skippedEmpty: number;
  errors: string[];
  batchId: string;
};

/** Flexible CSV / Excel ingest with validation, batch tracking, and per-row errors. */
export async function importSpreadsheetBuffer(
  formData: FormData,
): Promise<ImportSpreadsheetResult> {
  const session = await requireImporter();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Attach a file.");

  const buf = Buffer.from(await file.arrayBuffer());
  validateUpload(file, buf);
  const hash = fileHash(buf);
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

  const batch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      fileHash: hash,
      status: "PENDING",
      totalRows: parsed.rows.length,
      createdById: session.user.id,
    },
  });

  let created = 0;
  let skippedDup = 0;
  const errors: string[] = [];

  for (const rawRow of parsed.rows) {
    try {
      const rowValidation = validateImportRow(rawRow);
      if (rowValidation.status === "reject") {
        skippedDup++;
        errors.push(`Row ${rawRow.rowNumber}: ${rowValidation.messages.join("; ")}`);
        continue;
      }

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

  const status =
    created === 0 && errors.length > 0
      ? "FAILED"
      : errors.length > 0
        ? "PARTIAL"
        : "COMPLETED";

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status,
      createdCount: created,
      skippedCount: skippedDup,
      rejectedCount: errors.length,
      errorSummary: errors.slice(0, 100),
    },
  });

  await auditLog({
    actorId: session.user.id,
    action: "IMPORT",
    entityType: "ImportBatch",
    entityId: batch.id,
    summary: `Imported ${created} rows, skipped ${skippedDup} duplicates`,
    payload: { filename: file.name, errorCount: errors.length, fileHash: hash },
  });

  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  revalidatePath("/imports");

  return {
    created,
    skippedDup,
    skippedEmpty: parsed.skippedEmpty,
    errors: errors.slice(0, 50),
    batchId: batch.id,
  };
}

export async function previewPdfText(formData: FormData) {
  await requireImporter();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Attach a PDF.");

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new Error("PDF exceeds size limit.");
  }

  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buf);
  const lines = parsed.text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 80);

  return { lines, pages: parsed.numpages };
}
