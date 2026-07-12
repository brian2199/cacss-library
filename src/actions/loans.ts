"use server";

import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import {
  checkoutCopiesTransaction,
  returnCopyByBarcodeTransaction,
} from "@/lib/circulation";

function invalidateLoanViews(itemId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/checkout");
  revalidatePath("/loans");
  revalidatePath("/approvals");
  revalidatePath("/catalog");
  revalidatePath("/account");
  revalidatePath(`/catalog/${itemId}`);
}

async function requireStaff() {
  const session = await auth();
  if (
    !session?.user?.id ||
    !["LIBRARIAN", "ADMIN"].includes(session.user.role)
  ) {
    throw new Error("Only librarians can perform this action.");
  }
  return session;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Admin privileges required.");
  }
  return session;
}

export async function checkoutCopy(params: {
  itemCopyId: string;
  memberProfileId: string;
}) {
  const session = await requireStaff();
  const { loanIds } = await checkoutCopiesTransaction({
    itemCopyIds: [params.itemCopyId],
    memberProfileId: params.memberProfileId,
    approvedByUserId: session.user.id,
  });

  const copy = await prisma.itemCopy.findUnique({
    where: { id: params.itemCopyId },
    include: { item: true },
  });

  await auditLog({
    actorId: session.user.id,
    action: "CHECKOUT",
    entityType: "Loan",
    entityId: loanIds[0],
    summary: copy ? `Checked out ${copy.item.title}` : "Checked out copy",
    payload: { copyId: params.itemCopyId, memberProfileId: params.memberProfileId },
  });

  if (copy) invalidateLoanViews(copy.item.id);
  return loanIds[0]!;
}

export async function checkoutMultipleCopies(params: {
  itemCopyIds: string[];
  memberProfileId: string;
}) {
  const session = await requireStaff();
  const { loanIds, titles } = await checkoutCopiesTransaction({
    itemCopyIds: params.itemCopyIds,
    memberProfileId: params.memberProfileId,
    approvedByUserId: session.user.id,
  });

  await auditLog({
    actorId: session.user.id,
    action: "CHECKOUT",
    entityType: "Loan",
    summary: `Checked out ${titles.length} item(s): ${titles.slice(0, 3).join("; ")}${titles.length > 3 ? "…" : ""}`,
    payload: {
      loanIds,
      memberProfileId: params.memberProfileId,
      count: titles.length,
    },
  });

  const copies = await prisma.itemCopy.findMany({
    where: { id: { in: params.itemCopyIds } },
    select: { itemId: true },
  });
  for (const c of copies) invalidateLoanViews(c.itemId);

  return { loanIds, count: loanIds.length, titles };
}

export async function approveRareLoan(loanId: string) {
  const session = await requireAdmin();
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { itemCopy: { include: { item: true } } },
  });
  if (!loan || loan.status !== "PENDING_RARE_APPROVAL") {
    throw new Error("Nothing to approve.");
  }

  const days = loan.itemCopy.item.loanDaysRare;
  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: {
      status: "ACTIVE",
      approvedByUserId: session.user.id,
      dueDate: addDays(new Date(), days),
      dueDateAcknowledgedAt: new Date(),
    },
  });

  await auditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Loan",
    entityId: loanId,
    summary: `Approved rare loan for ${loan.itemCopy.item.title}`,
  });

  invalidateLoanViews(loan.itemCopy.item.id);
  return updated.id;
}

export async function denyRareLoan(loanId: string) {
  const session = await requireAdmin();
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, status: "PENDING_RARE_APPROVAL" },
    include: { itemCopy: true },
  });
  if (!loan) return;

  await prisma.loan.delete({ where: { id: loanId } });
  await auditLog({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Loan",
    entityId: loanId,
    summary: "Rare checkout request denied",
  });

  invalidateLoanViews(loan.itemCopy.itemId);
}

export async function returnLoan(loanId: string, damageNote?: string) {
  const session = await requireStaff();
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { itemCopy: { include: { item: true } } },
  });
  if (!loan || loan.status !== "ACTIVE") throw new Error("Loan not active.");

  await prisma.loan.update({
    where: { id: loanId },
    data: {
      status: "RETURNED",
      returnedAt: new Date(),
      reportedDamageOnReturn: damageNote?.trim() || null,
    },
  });

  if (damageNote?.trim()) {
    await prisma.itemConditionHistory.create({
      data: {
        itemCopyId: loan.itemCopyId,
        condition: "Returned with reported damage",
        notes: damageNote.trim(),
        recordedById: session.user.id,
      },
    });
    await prisma.itemCopy.update({
      where: { id: loan.itemCopyId },
      data: { damaged: true },
    });
  }

  await auditLog({
    actorId: session.user.id,
    action: "RETURN",
    entityType: "Loan",
    entityId: loanId,
    summary: `Returned ${loan.itemCopy.item.title}`,
  });

  invalidateLoanViews(loan.itemCopy.item.id);
}

export async function returnLoanByBarcode(barcode: string, damageNote?: string) {
  const session = await requireStaff();
  const result = await returnCopyByBarcodeTransaction(
    barcode,
    session.user.id,
    damageNote,
  );

  if (result.status === "no_loan") throw new Error(result.message);
  if (result.status === "already_returned") {
    return { alreadyReturned: true as const, title: result.title, message: result.message };
  }

  await auditLog({
    actorId: session.user.id,
    action: "RETURN",
    entityType: "Loan",
    entityId: result.loanId,
    summary: `Returned ${result.title}`,
  });

  const copy = await prisma.itemCopy.findFirst({
    where: { barcode: { equals: barcode, mode: "insensitive" } },
    include: { item: true },
  });
  if (copy) invalidateLoanViews(copy.item.id);

  return {
    alreadyReturned: false as const,
    title: result.title,
    borrower: result.borrower,
  };
}

export async function renewLoan(loanId: string) {
  const session = await requireStaff();
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { itemCopy: { include: { item: true } } },
  });
  if (!loan || loan.status !== "ACTIVE") throw new Error("Loan not active.");
  if (loan.renewalCount >= loan.maxRenewals) throw new Error("No renewals left.");
  if (loan.itemCopy.item.requiresRareApproval || loan.itemCopy.item.rareProtected) {
    throw new Error("Rare titles renew only at the desk with librarian approval.");
  }

  const extra = loan.itemCopy.item.loanDaysDefault;
  await prisma.loan.update({
    where: { id: loanId },
    data: {
      renewalCount: { increment: 1 },
      dueDate: addDays(loan.dueDate, extra),
    },
  });

  await auditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Loan",
    entityId: loanId,
    summary: "Loan renewed",
  });

  invalidateLoanViews(loan.itemCopy.item.id);
}

export async function acknowledgeDueDate(loanId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized.");
  await prisma.loan.updateMany({
    where: {
      id: loanId,
      memberProfile: { userId: session.user.id },
      status: "ACTIVE",
    },
    data: { dueDateAcknowledgedAt: new Date() },
  });

  revalidatePath("/loans");
  revalidatePath("/account");
  revalidatePath("/dashboard");
}
