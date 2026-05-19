"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { ItemFormat } from "@prisma/client";

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

/** Flexible CSV / spreadsheet ingest with duplicate detection on ISBN or title+year. */
export async function importSpreadsheetBuffer(formData: FormData) {
  const session = await requireImporter();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Attach a file.");

  const buf = Buffer.from(await file.arrayBuffer());
  const lower = file.name.toLowerCase();

  let rows: Record<string, string>[] = [];

  if (lower.endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, string>>(buf.toString("utf8"), {
      header: true,
      skipEmptyLines: true,
    });
    rows = parsed.data;
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
  } else {
    throw new Error("Use CSV or Excel for now — PDF flows extract to text preview separately.");
  }

  let created = 0;
  let skippedDup = 0;

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

  for (const raw of rows) {
    const title =
      raw.title ?? raw.Title ?? raw.TITLE ?? raw.name ?? raw.Item ?? "";
    if (!title.trim()) continue;

    const subtitle = raw.subtitle ?? raw.Subtitle ?? "";
    const authorRaw =
      raw.author ?? raw.Authors ?? raw.author_s ?? raw.Author ?? "Unknown";
    const yearStr =
      raw.year ?? raw.Year ?? raw.publication_year ?? raw.Published ?? "";
    const publicationYear = yearStr ? Number(yearStr) : null;
    const isbn = raw.isbn ?? raw.ISBN ?? "";
    const formatRaw = (
      raw.format ??
      raw.Format ??
      raw.type ??
      "BOOK"
    ).toUpperCase();
    const formatValues = new Set<string>(Object.values(ItemFormat));
    const format = formatValues.has(formatRaw)
      ? (formatRaw as ItemFormat)
      : ItemFormat.BOOK;

    let duplicate = false;
    if (isbn?.trim()) {
      duplicate = !!(await prisma.item.findFirst({
        where: { isbn: isbn.trim() },
      }));
    } else if (publicationYear) {
      duplicate = !!(await prisma.item.findFirst({
        where: {
          title: { equals: title.trim(), mode: "insensitive" },
          publicationYear,
        },
      }));
    }

    if (duplicate) {
      skippedDup++;
      continue;
    }

    const names = authorRaw.split(/;/).map((s) => s.trim()).filter(Boolean);
    const authorLinks: { id: string }[] = [];
    for (const displayName of names.length ? names : ["Unknown"]) {
      const normalizedName = normalizeAuthor(displayName);
      const author = await prisma.author.upsert({
        where: { normalizedName },
        update: {},
        create: { normalizedName, displayName },
      });
      authorLinks.push(author);
    }

    await prisma.item.create({
      data: {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        publicationYear: publicationYear ?? undefined,
        format,
        isbn: isbn?.trim() || null,
        branchId: branch.id,
        categoryId: inboxCategory.id,
        copies: {
          create: {
            copyNumber: 1,
            barcode:
              raw.barcode?.trim() ||
              `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    created++;
  }

  await auditLog({
    actorId: session.user.id,
    action: "IMPORT",
    entityType: "Item",
    summary: `Imported ${created} rows, skipped ${skippedDup} duplicates`,
    payload: { filename: file.name },
  });

  revalidatePath("/catalog");
  revalidatePath("/dashboard");

  return { created, skippedDup };
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
