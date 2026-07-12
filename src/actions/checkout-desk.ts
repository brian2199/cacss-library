"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkoutMultipleCopies, returnLoanByBarcode } from "@/actions/loans";
import { auditLog } from "@/lib/audit";
import { normalizeScanInput, extractIsbnCandidates, digitsOnly } from "@/lib/barcode";
import { isSpecialItem } from "@/lib/item-display";
import { isDevelopment, DEV_DEMO_PASSWORD } from "@/lib/env";
import { isLoanOverdue } from "@/lib/circulation";
import { MembershipStatus, UserRole } from "@prisma/client";

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

export type DeskMember = {
  id: string;
  label: string;
  email: string;
  phone: string | null;
  activeLoans: number;
  overdueLoans: number;
  membershipStatus: MembershipStatus;
};

export async function listDeskMembers(): Promise<DeskMember[]> {
  await requireStaff();
  const members = await prisma.memberProfile.findMany({
    where: { membershipStatus: "ACTIVE" },
    include: {
      user: true,
      loans: {
        where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return members.map((m) => ({
    id: m.id,
    label: m.user.name ?? m.user.email,
    email: m.user.email,
    phone: m.phone,
    activeLoans: m.loans.length,
    overdueLoans: m.loans.filter((l) => isLoanOverdue(l)).length,
    membershipStatus: m.membershipStatus,
  }));
}

export async function searchDeskMembers(query: string): Promise<DeskMember[]> {
  await requireStaff();
  const q = query.trim();
  if (q.length < 1) return listDeskMembers();

  const members = await prisma.memberProfile.findMany({
    where: {
      membershipStatus: "ACTIVE",
      OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { phone: { contains: q, mode: "insensitive" } },
        { id: q.length >= 8 ? q : undefined },
      ],
    },
    include: {
      user: true,
      loans: {
        where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
      },
    },
    orderBy: { user: { name: "asc" } },
    take: 25,
  });

  return members.map((m) => ({
    id: m.id,
    label: m.user.name ?? m.user.email,
    email: m.user.email,
    phone: m.phone,
    activeLoans: m.loans.length,
    overdueLoans: m.loans.filter((l) => isLoanOverdue(l)).length,
    membershipStatus: m.membershipStatus,
  }));
}

export type DeskCopyOption = {
  copyId: string;
  copyNumber: number;
  barcode: string | null;
  shelfHint: string | null;
  dueDatePreview?: string;
};

export type BasketItem = {
  copyId: string;
  copyNumber: number;
  barcode: string | null;
  title: string;
  authors: string;
  shelfHint: string | null;
  isSpecial: boolean;
};

export type ResolveForCheckoutResult =
  | {
      status: "ready";
      itemId: string;
      title: string;
      authors: string;
      isSpecial: boolean;
      copies: DeskCopyOption[];
    }
  | {
      status: "on_loan";
      itemId: string;
      title: string;
      copyId: string;
      barcode: string | null;
      borrower: string;
      dueDate: string;
      loanId: string;
    }
  | {
      status: "not_found";
      message: string;
    }
  | {
      status: "unavailable";
      title: string;
      reason: string;
    };

async function copiesWithAvailability(itemId: string): Promise<DeskCopyOption[]> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return [];

  const copies = await prisma.itemCopy.findMany({
    where: { itemId, missing: false, damaged: false },
    include: {
      shelfLocation: true,
      loans: {
        where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
      },
    },
    orderBy: { copyNumber: "asc" },
  });

  const loanDays = item.requiresRareApproval || item.rareProtected
    ? item.loanDaysRare
    : item.loanDaysDefault;
  const duePreview = new Date();
  duePreview.setDate(duePreview.getDate() + loanDays);

  return copies
    .filter((c) => c.loans.length === 0)
    .map((c) => ({
      copyId: c.id,
      copyNumber: c.copyNumber,
      barcode: c.barcode,
      shelfHint: c.shelfLocation?.label ?? c.shelfLocation?.code ?? null,
      dueDatePreview: duePreview.toISOString(),
    }));
}

export type BookSearchHit = {
  itemId: string;
  title: string;
  authors: string;
  publicationYear: number | null;
  availableCount: number;
  isSpecial: boolean;
};

export async function searchBooksForCheckout(query: string): Promise<BookSearchHit[]> {
  await requireStaff();
  const q = query.trim();
  if (q.length < 2) return [];

  const items = await prisma.item.findMany({
    where: {
      checkoutEligible: true,
      referenceOnly: false,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { subtitle: { contains: q, mode: "insensitive" } },
        {
          authors: {
            some: {
              author: {
                displayName: { contains: q, mode: "insensitive" },
              },
            },
          },
        },
        { isbn: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      authors: { include: { author: true }, orderBy: { sortOrder: "asc" } },
      copies: {
        where: { missing: false, damaged: false },
        include: {
          loans: {
            where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
          },
        },
      },
    },
    orderBy: { title: "asc" },
    take: 20,
  });

  const hits: BookSearchHit[] = [];
  for (const item of items) {
    const availableCount = item.copies.filter((c) => c.loans.length === 0).length;
    if (availableCount === 0) continue;
    hits.push({
      itemId: item.id,
      title: item.title,
      authors:
        item.authors.map((a) => a.author.displayName).join(", ") || "Unknown author",
      publicationYear: item.publicationYear,
      availableCount,
      isSpecial: isSpecialItem(item),
    });
  }
  return hits;
}

async function buildReadyResult(itemId: string): Promise<ResolveForCheckoutResult> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { authors: { include: { author: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!item) {
    return { status: "not_found", message: "Item not found." };
  }
  if (item.referenceOnly || !item.checkoutEligible) {
    return {
      status: "unavailable",
      title: item.title,
      reason: "Reference-only — cannot leave the library.",
    };
  }
  const copies = await copiesWithAvailability(item.id);
  if (!copies.length) {
    return {
      status: "unavailable",
      title: item.title,
      reason: "No copies available to check out.",
    };
  }
  return {
    status: "ready",
    itemId: item.id,
    title: item.title,
    authors: item.authors.map((a) => a.author.displayName).join(", ") || "Unknown author",
    isSpecial: isSpecialItem(item),
    copies,
  };
}

export async function selectItemForCheckout(
  itemId: string,
): Promise<ResolveForCheckoutResult> {
  await requireStaff();
  return buildReadyResult(itemId);
}

export type CreateMemberResult = {
  member: DeskMember;
  /** One-time temporary password (production). Omitted in development when using shared demo password. */
  temporaryPassword?: string;
  devPasswordHint?: string;
};

export async function createDeskMember(input: {
  name: string;
  email: string;
  phone?: string;
}): Promise<CreateMemberResult> {
  const session = await requireStaff();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("Name is required.");
  if (!email || !email.includes("@")) throw new Error("Valid email is required.");

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberProfile: true },
  });
  if (existing) {
    if (existing.memberProfile) {
      throw new Error(
        `${existing.name ?? email} already has a member profile. Select them from the list.`,
      );
    }
    throw new Error("That email is already used by a staff account.");
  }

  const similar = await prisma.user.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      memberProfile: { isNot: null },
    },
    take: 3,
    include: { memberProfile: true },
  });
  if (similar.length) {
    const names = similar.map((s) => s.name ?? s.email).join(", ");
    throw new Error(`Possible duplicate member(s): ${names}. Search before creating.`);
  }

  const tempPassword = isDevelopment()
    ? DEV_DEMO_PASSWORD
    : randomBytes(12).toString("base64url");

  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: UserRole.MEMBER,
      passwordHash,
      memberProfile: {
        create: {
          membershipStatus: MembershipStatus.ACTIVE,
          phone: input.phone?.trim() || null,
        },
      },
    },
    include: { memberProfile: true },
  });

  if (!user.memberProfile) throw new Error("Could not create member profile.");

  await auditLog({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "MemberProfile",
    entityId: user.memberProfile.id,
    summary: `Desk added member ${name}`,
    payload: { email },
  });

  revalidatePath("/checkout");
  revalidatePath("/members");

  const member: DeskMember = {
    id: user.memberProfile.id,
    label: name,
    email,
    phone: user.memberProfile.phone,
    activeLoans: 0,
    overdueLoans: 0,
    membershipStatus: MembershipStatus.ACTIVE,
  };

  if (isDevelopment()) {
    return { member, devPasswordHint: DEV_DEMO_PASSWORD };
  }
  return { member, temporaryPassword: tempPassword };
}

export async function resolveForCheckout(
  barcode: string,
): Promise<ResolveForCheckoutResult> {
  await requireStaff();
  const code = normalizeScanInput(barcode);
  if (!code) throw new Error("Scan or enter a barcode.");

  const copy = await prisma.itemCopy.findFirst({
    where: { barcode: { equals: code, mode: "insensitive" } },
    include: {
      item: { include: { authors: { include: { author: true } } } },
      shelfLocation: true,
      loans: {
        where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
        include: { memberProfile: { include: { user: true } } },
      },
    },
  });

  if (copy) {
    const authors = copy.item.authors
      .map((a) => a.author.displayName)
      .join(", ");
    if (copy.loans.length > 0) {
      const loan = copy.loans[0]!;
      return {
        status: "on_loan",
        itemId: copy.item.id,
        title: copy.item.title,
        copyId: copy.id,
        barcode: copy.barcode,
        borrower:
          loan.memberProfile.user.name ?? loan.memberProfile.user.email,
        dueDate: loan.dueDate.toISOString(),
        loanId: loan.id,
      };
    }
    if (copy.missing) {
      return {
        status: "unavailable",
        title: copy.item.title,
        reason: "This copy is marked missing.",
      };
    }
    if (copy.damaged) {
      return {
        status: "unavailable",
        title: copy.item.title,
        reason: "This copy is marked damaged — review before checkout.",
      };
    }
    if (copy.item.referenceOnly || !copy.item.checkoutEligible) {
      return {
        status: "unavailable",
        title: copy.item.title,
        reason: "Reference-only — cannot leave the library.",
      };
    }
    return {
      status: "ready",
      itemId: copy.item.id,
      title: copy.item.title,
      authors,
      isSpecial: isSpecialItem(copy.item),
      copies: [
        {
          copyId: copy.id,
          copyNumber: copy.copyNumber,
          barcode: copy.barcode,
          shelfHint: copy.shelfLocation?.label ?? copy.shelfLocation?.code ?? null,
        },
      ],
    };
  }

  const isbnCandidates = extractIsbnCandidates(code);
  const isbnFilters = isbnCandidates.map((isbn) => ({ isbn: { equals: isbn } }));
  const d = digitsOnly(code);
  if (d.length >= 10) isbnFilters.push({ isbn: { equals: d } });

  if (isbnFilters.length) {
    const items = await prisma.item.findMany({
      where: { OR: isbnFilters },
      include: { authors: { include: { author: true } } },
      take: 5,
    });
    for (const item of items) {
      if (item.referenceOnly || !item.checkoutEligible) {
        return {
          status: "unavailable",
          title: item.title,
          reason: "Reference-only — cannot leave the library.",
        };
      }
      const available = await copiesWithAvailability(item.id);
      if (available.length) {
        return {
          status: "ready",
          itemId: item.id,
          title: item.title,
          authors: item.authors.map((a) => a.author.displayName).join(", "),
          isSpecial: isSpecialItem(item),
          copies: available,
        };
      }
    }
  }

  return {
    status: "not_found",
    message: "No copy found for that barcode. Try catalog search or add the item first.",
  };
}

export async function deskCheckoutBasket(params: {
  itemCopyIds: string[];
  memberProfileId: string;
}) {
  await requireStaff();
  const result = await checkoutMultipleCopies(params);
  revalidatePath("/checkout");
  revalidatePath("/loans");
  return {
    count: result.count,
    titles: result.titles,
    message: `Checked out ${result.count} item${result.count === 1 ? "" : "s"}.`,
  };
}

/** @deprecated Use deskCheckoutBasket — kept for single-item callers */
export async function deskCheckout(params: {
  itemCopyId: string;
  memberProfileId: string;
}) {
  return deskCheckoutBasket({
    itemCopyIds: [params.itemCopyId],
    memberProfileId: params.memberProfileId,
  });
}

export async function deskReturnByBarcode(barcode: string) {
  await requireStaff();
  const result = await returnLoanByBarcode(barcode);
  revalidatePath("/checkout");
  revalidatePath("/loans");
  if (result.alreadyReturned) {
    return {
      title: result.title,
      borrower: "",
      alreadyReturned: true,
      message: result.message,
    };
  }
  return {
    title: result.title,
    borrower: result.borrower,
    alreadyReturned: false,
    message: `Returned “${result.title}” from ${result.borrower}.`,
  };
}

export async function getBasketCopyDetails(
  copyIds: string[],
): Promise<BasketItem[]> {
  await requireStaff();
  if (!copyIds.length) return [];

  const copies = await prisma.itemCopy.findMany({
    where: { id: { in: copyIds } },
    include: {
      item: {
        include: {
          authors: { include: { author: true }, orderBy: { sortOrder: "asc" } },
        },
      },
      shelfLocation: true,
    },
  });

  return copies.map((c) => ({
    copyId: c.id,
    copyNumber: c.copyNumber,
    barcode: c.barcode,
    title: c.item.title,
    authors:
      c.item.authors.map((a) => a.author.displayName).join(", ") || "Unknown author",
    shelfHint: c.shelfLocation?.label ?? c.shelfLocation?.code ?? null,
    isSpecial: isSpecialItem(c.item),
  }));
}
