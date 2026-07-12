import { addDays } from "date-fns";
import type { Item, ItemCopy, Loan, LoanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MAX_ACTIVE_LOANS_MEMBER = 7;

export type CopyWithItem = ItemCopy & { item: Item };

export type CheckoutBlockReason =
  | "copy_not_found"
  | "copy_missing"
  | "copy_damaged"
  | "already_on_loan"
  | "reference_only"
  | "not_checkout_eligible"
  | "member_limit";

export type CheckoutEligibility =
  | { ok: true; needsRareApproval: boolean; loanDays: number }
  | { ok: false; reason: CheckoutBlockReason; message: string };

export function computeDueDate(from: Date, loanDays: number): Date {
  return addDays(from, loanDays);
}

export function isLoanOverdue(loan: Pick<Loan, "status" | "dueDate" | "returnedAt">): boolean {
  if (loan.status !== "ACTIVE" || loan.returnedAt) return false;
  return loan.dueDate < new Date();
}

export function evaluateCheckoutEligibility(
  copy: CopyWithItem,
  activeLoanCount: number,
  hasActiveLoanOnCopy: boolean,
): CheckoutEligibility {
  if (copy.missing) {
    return { ok: false, reason: "copy_missing", message: "This copy is marked missing." };
  }
  if (hasActiveLoanOnCopy) {
    return { ok: false, reason: "already_on_loan", message: "Copy is already on loan." };
  }
  if (copy.item.referenceOnly || !copy.item.checkoutEligible) {
    return {
      ok: false,
      reason: "reference_only",
      message: "Reference-only — cannot leave the library.",
    };
  }
  if (activeLoanCount >= MAX_ACTIVE_LOANS_MEMBER) {
    return {
      ok: false,
      reason: "member_limit",
      message: "Member has reached the checkout limit.",
    };
  }

  const needsRareApproval = copy.item.requiresRareApproval || copy.item.rareProtected;
  const loanDays = needsRareApproval ? copy.item.loanDaysRare : copy.item.loanDaysDefault;

  return { ok: true, needsRareApproval, loanDays };
}

export function loanStatusForCheckout(needsRareApproval: boolean): LoanStatus {
  return needsRareApproval ? "PENDING_RARE_APPROVAL" : "ACTIVE";
}

/** Transactional multi-copy checkout — all succeed or none. */
export async function checkoutCopiesTransaction(params: {
  itemCopyIds: string[];
  memberProfileId: string;
  approvedByUserId: string;
}): Promise<{ loanIds: string[]; titles: string[] }> {
  const uniqueIds = [...new Set(params.itemCopyIds)];
  if (!uniqueIds.length) throw new Error("No copies selected.");

  return prisma.$transaction(async (tx) => {
    const activeMemberLoans = await tx.loan.count({
      where: {
        memberProfileId: params.memberProfileId,
        status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] },
      },
    });

    const copies = await tx.itemCopy.findMany({
      where: { id: { in: uniqueIds } },
      include: {
        item: true,
        loans: { where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } } },
      },
    });

    if (copies.length !== uniqueIds.length) {
      throw new Error("One or more copies could not be found.");
    }

    let runningActive = activeMemberLoans;
    const loanIds: string[] = [];
    const titles: string[] = [];
    const now = new Date();

    for (const copy of copies) {
      const eligibility = evaluateCheckoutEligibility(
        copy,
        runningActive,
        copy.loans.length > 0,
      );
      if (!eligibility.ok) {
        throw new Error(`${copy.item.title}: ${eligibility.message}`);
      }

      const status = loanStatusForCheckout(eligibility.needsRareApproval);
      const loan = await tx.loan.create({
        data: {
          memberProfileId: params.memberProfileId,
          itemCopyId: copy.id,
          dueDate: computeDueDate(now, eligibility.loanDays),
          status,
          approvedByUserId: eligibility.needsRareApproval ? null : params.approvedByUserId,
          dueDateAcknowledgedAt: eligibility.needsRareApproval ? null : now,
        },
      });

      loanIds.push(loan.id);
      titles.push(copy.item.title);
      if (status === "ACTIVE" || status === "PENDING_RARE_APPROVAL") {
        runningActive++;
      }
    }

    return { loanIds, titles };
  });
}

export type ReturnCopyResult =
  | { status: "returned"; loanId: string; title: string; borrower: string }
  | { status: "already_returned"; title: string; message: string }
  | { status: "no_loan"; message: string };

/** Idempotent return by copy barcode — safe for repeated scans. */
export async function returnCopyByBarcodeTransaction(
  barcode: string,
  actorUserId: string,
  damageNote?: string,
): Promise<ReturnCopyResult> {
  const copy = await prisma.itemCopy.findFirst({
    where: { barcode: { equals: barcode, mode: "insensitive" } },
    include: {
      item: true,
      loans: {
        where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } },
        include: { memberProfile: { include: { user: true } } },
        orderBy: { checkedOutAt: "desc" },
      },
    },
  });

  if (!copy) {
    return { status: "no_loan", message: "No copy found for that barcode." };
  }

  const activeLoan = copy.loans[0];
  if (!activeLoan) {
    const lastReturned = await prisma.loan.findFirst({
      where: { itemCopyId: copy.id, status: "RETURNED" },
      orderBy: { returnedAt: "desc" },
    });
    if (lastReturned?.returnedAt) {
      return {
        status: "already_returned",
        title: copy.item.title,
        message: `Already returned on ${lastReturned.returnedAt.toLocaleDateString()}.`,
      };
    }
    return { status: "no_loan", message: "No active loan on this copy." };
  }

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.loan.findUnique({ where: { id: activeLoan.id } });
    if (!fresh || fresh.status !== "ACTIVE") {
      if (fresh?.status === "PENDING_RARE_APPROVAL") {
        throw new Error("Rare approval pending — cancel or approve before return.");
      }
      return;
    }

    await tx.loan.update({
      where: { id: activeLoan.id },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
        reportedDamageOnReturn: damageNote?.trim() || null,
      },
    });

    if (damageNote?.trim()) {
      await tx.itemConditionHistory.create({
        data: {
          itemCopyId: copy.id,
          condition: "Returned with reported damage",
          notes: damageNote.trim(),
          recordedById: actorUserId,
        },
      });
      await tx.itemCopy.update({
        where: { id: copy.id },
        data: { damaged: true },
      });
    }
  });

  return {
    status: "returned",
    loanId: activeLoan.id,
    title: copy.item.title,
    borrower: activeLoan.memberProfile.user.name ?? activeLoan.memberProfile.user.email,
  };
}
