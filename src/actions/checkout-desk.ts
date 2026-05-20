"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkoutCopy, returnLoan } from "@/actions/loans";
import { normalizeScanInput, extractIsbnCandidates, digitsOnly } from "@/lib/barcode";
import { isSpecialItem } from "@/lib/item-display";

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
  activeLoans: number;
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
    activeLoans: m.loans.length,
  }));
}

export type DeskCopyOption = {
  copyId: string;
  copyNumber: number;
  barcode: string | null;
  shelfHint: string | null;
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
  const copies = await prisma.itemCopy.findMany({
    where: { itemId, missing: false },
    include: {
      shelfLocation: true,
      loans: {
        where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
      },
    },
    orderBy: { copyNumber: "asc" },
  });

  return copies
    .filter((c) => c.loans.length === 0)
    .map((c) => ({
      copyId: c.id,
      copyNumber: c.copyNumber,
      barcode: c.barcode,
      shelfHint: c.shelfLocation?.label ?? c.shelfLocation?.code ?? null,
    }));
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
    if (copy.item.referenceOnly || !copy.item.checkoutEligible) {
      return {
        status: "unavailable",
        title: copy.item.title,
        reason: "Reference-only — cannot leave the library.",
      };
    }
    const available = await copiesWithAvailability(copy.item.id);
    return {
      status: "ready",
      itemId: copy.item.id,
      title: copy.item.title,
      authors,
      isSpecial: isSpecialItem(copy.item),
      copies: available.length ? available : [
        {
          copyId: copy.id,
          copyNumber: copy.copyNumber,
          barcode: copy.barcode,
          shelfHint: copy.shelfLocation?.label ?? null,
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

export async function deskCheckout(params: {
  itemCopyId: string;
  memberProfileId: string;
}) {
  await requireStaff();
  const loanId = await checkoutCopy(params);
  revalidatePath("/checkout");
  revalidatePath("/loans");
  return { loanId, message: "Checked out successfully." };
}

export async function deskReturnByBarcode(barcode: string) {
  await requireStaff();
  const code = normalizeScanInput(barcode);
  const copy = await prisma.itemCopy.findFirst({
    where: { barcode: { equals: code, mode: "insensitive" } },
    include: {
      item: true,
      loans: {
        where: { status: "ACTIVE" },
        include: { memberProfile: { include: { user: true } } },
      },
    },
  });
  if (!copy?.loans[0]) {
    throw new Error("No active loan on this copy.");
  }
  const loan = copy.loans[0];
  await returnLoan(loan.id);
  revalidatePath("/checkout");
  revalidatePath("/loans");
  return {
    title: copy.item.title,
    borrower: loan.memberProfile.user.name ?? loan.memberProfile.user.email,
  };
}
