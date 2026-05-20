"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { auditLog } from "@/lib/audit";
import { normalizeScanInput, extractIsbnCandidates, digitsOnly } from "@/lib/barcode";
import { lookupBookMetadata, type BookLookupMetadata } from "@/lib/book-lookup";
import { prisma } from "@/lib/prisma";
import { ItemFormat } from "@prisma/client";

async function requireStaff() {
  const session = await auth();
  if (
    !session?.user?.id ||
    !["LIBRARIAN", "ADMIN"].includes(session.user.role)
  ) {
    throw new Error("Unauthorized");
  }
  return session;
}

export type ResolveBarcodeResult =
  | {
      status: "local_copy";
      itemId: string;
      copyId: string;
      title: string;
      barcode: string;
    }
  | {
      status: "local_isbn";
      itemId: string;
      title: string;
      isbn: string;
    }
  | {
      status: "lookup";
      barcode: string;
      metadata: BookLookupMetadata;
    }
  | {
      status: "not_found";
      barcode: string;
      message: string;
    };

export async function resolveBarcode(raw: string): Promise<ResolveBarcodeResult> {
  await requireStaff();
  const barcode = normalizeScanInput(raw);
  if (!barcode) throw new Error("Enter or scan a barcode.");

  const copy = await prisma.itemCopy.findFirst({
    where: { barcode: { equals: barcode, mode: "insensitive" } },
    include: { item: { select: { id: true, title: true } } },
  });
  if (copy?.item) {
    return {
      status: "local_copy",
      itemId: copy.item.id,
      copyId: copy.id,
      title: copy.item.title,
      barcode: copy.barcode ?? barcode,
    };
  }

  const isbnCandidates = extractIsbnCandidates(barcode);
  for (const isbn of isbnCandidates) {
    const item = await prisma.item.findFirst({
      where: {
        OR: [
          { isbn: isbn },
          { isbn: digitsOnly(isbn) },
        ],
      },
      select: { id: true, title: true, isbn: true },
    });
    if (item) {
      return {
        status: "local_isbn",
        itemId: item.id,
        title: item.title,
        isbn: item.isbn ?? isbn,
      };
    }
  }

  const metadata = await lookupBookMetadata(barcode);
  if (metadata) {
    return { status: "lookup", barcode, metadata };
  }

  return {
    status: "not_found",
    barcode,
    message:
      "No local copy and no public book record found. Try CSV import or add manually from the catalog.",
  };
}

export type AddItemFromScanInput = {
  barcode: string;
  title: string;
  subtitle?: string;
  authors?: string[];
  isbn?: string;
  publicationYear?: number;
  publisher?: string;
  pageCount?: number;
  format?: ItemFormat;
  notes?: string;
};

/** Create bibliographic record + copy from scan desk (after UPC/ISBN lookup or manual confirm). */
export async function addItemFromScan(input: AddItemFromScanInput) {
  const session = await requireStaff();
  const barcode = normalizeScanInput(input.barcode);
  if (!barcode) throw new Error("Barcode is required.");
  if (!input.title?.trim()) throw new Error("Title is required.");

  const existingCopy = await prisma.itemCopy.findFirst({
    where: { barcode: { equals: barcode, mode: "insensitive" } },
  });
  if (existingCopy) {
    throw new Error(`Barcode already assigned to copy ${existingCopy.id}.`);
  }

  const isbn = input.isbn?.trim() ? digitsOnly(input.isbn) || input.isbn.trim() : null;
  if (isbn) {
    const dup = await prisma.item.findFirst({ where: { isbn } });
    if (dup) {
      throw new Error(
        `ISBN already on record “${dup.title}”. Add a new copy from that item instead.`,
      );
    }
  }

  const branch = await prisma.branch.findFirst();
  if (!branch) throw new Error("Run database seed before adding items.");

  const inboxCategory =
    (await prisma.category.findUnique({ where: { slug: "imports-inbox" } })) ??
    (await prisma.category.create({
      data: {
        name: "Imports inbox",
        slug: "imports-inbox",
        description: "Staged from scan desk / imports until recategorized.",
      },
    }));

  const names = (input.authors?.length ? input.authors : ["Unknown"]).map((a) =>
    a.trim(),
  ).filter(Boolean);

  const authorLinks: { id: string }[] = [];
  for (const displayName of names) {
    const normalizedName = displayName.toLowerCase().replace(/\s+/g, " ");
    const author = await prisma.author.upsert({
      where: { normalizedName },
      update: {},
      create: { normalizedName, displayName },
    });
    authorLinks.push(author);
  }

  const item = await prisma.item.create({
    data: {
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      publicationYear: input.publicationYear ?? undefined,
      publisher: input.publisher?.trim() || null,
      pages: input.pageCount ?? undefined,
      format: input.format ?? ItemFormat.BOOK,
      isbn,
      notes: input.notes?.trim() || null,
      branchId: branch.id,
      categoryId: inboxCategory.id,
      copies: {
        create: {
          copyNumber: 1,
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
    include: { copies: true },
  });

  await auditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Item",
    entityId: item.id,
    summary: `Scan desk added “${item.title}” with barcode ${barcode}`,
    payload: { barcode, isbn },
  });

  revalidatePath("/catalog");
  revalidatePath("/dashboard");
  revalidatePath("/scan");

  return {
    itemId: item.id,
    copyId: item.copies[0]?.id,
    title: item.title,
  };
}

/** Attach a new copy barcode to an existing item (when ISBN matched but UPC is new). */
export async function addCopyBarcode(itemId: string, barcode: string) {
  const session = await requireStaff();
  const code = normalizeScanInput(barcode);
  if (!code) throw new Error("Barcode is required.");

  const existing = await prisma.itemCopy.findFirst({
    where: { barcode: { equals: code, mode: "insensitive" } },
  });
  if (existing) throw new Error("That barcode is already in use.");

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { copies: true },
  });
  if (!item) throw new Error("Item not found.");

  const maxCopy = item.copies.reduce((m, c) => Math.max(m, c.copyNumber), 0);
  const copy = await prisma.itemCopy.create({
    data: {
      itemId: item.id,
      copyNumber: maxCopy + 1,
      barcode: code,
    },
  });

  await auditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "ItemCopy",
    entityId: copy.id,
    summary: `Added copy barcode ${code} to “${item.title}”`,
  });

  revalidatePath("/catalog");
  revalidatePath(`/catalog/${itemId}`);

  return { copyId: copy.id, copyNumber: copy.copyNumber };
}
