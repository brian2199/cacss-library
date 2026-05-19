"use server";

import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

function invalidateLoanViews(itemId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/loans");
  revalidatePath("/approvals");
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${itemId}`);
}

const MAX_ACTIVE_LOANS_MEMBER = 7;

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

  const copy = await prisma.itemCopy.findUnique({
    where: { id: params.itemCopyId },
    include: {
      item: true,
      loans: { where: { status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] } } },
    },
  });
  if (!copy) throw new Error("Copy not found.");
  if (copy.missing) throw new Error("Cannot circulate a missing copy.");
  if (copy.loans.length > 0) throw new Error("Copy already on loan or pending.");

  const item = copy.item;
  if (item.referenceOnly || !item.checkoutEligible) {
    throw new Error("This title is reference-only and cannot leave the room.");
  }

  const activeCount = await prisma.loan.count({
    where: {
      memberProfileId: params.memberProfileId,
      status: { in: ["ACTIVE", "PENDING_RARE_APPROVAL"] },
    },
  });
  if (activeCount >= MAX_ACTIVE_LOANS_MEMBER) {
    throw new Error("Member has reached the checkout limit.");
  }

  const needsRare = item.requiresRareApproval || item.rareProtected;
  const loanDays = needsRare ? item.loanDaysRare : item.loanDaysDefault;
  const status = needsRare ? "PENDING_RARE_APPROVAL" : "ACTIVE";

  const loan = await prisma.loan.create({
    data: {
      memberProfileId: params.memberProfileId,
      itemCopyId: copy.id,
      dueDate: addDays(new Date(), loanDays),
      status,
      approvedByUserId: needsRare ? null : session.user.id,
      dueDateAcknowledgedAt: needsRare ? null : new Date(),
    },
  });

  await auditLog({
    actorId: session.user.id,
    action: "CHECKOUT",
    entityType: "Loan",
    entityId: loan.id,
    summary: needsRare
      ? `Rare checkout requested for ${item.title}`
      : `Checked out ${item.title}`,
    payload: { copyId: copy.id, memberProfileId: params.memberProfileId },
  });

  invalidateLoanViews(copy.item.id);
  return loan.id;
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
  revalidatePath("/dashboard");
}
