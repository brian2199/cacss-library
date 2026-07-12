import { describe, expect, it } from "vitest";
import {
  computeDueDate,
  evaluateCheckoutEligibility,
  isLoanOverdue,
  MAX_ACTIVE_LOANS_MEMBER,
} from "./circulation";
import type { Item, ItemCopy } from "@prisma/client";

const baseItem: Item = {
  id: "item1",
  title: "Test Book",
  subtitle: null,
  publicationYear: 2020,
  edition: null,
  publisher: null,
  isbn: null,
  pages: null,
  bindingType: null,
  format: "BOOK",
  categoryId: null,
  branchId: null,
  language: "en",
  rarityScore: 0,
  estimatedValue: null,
  checkoutEligible: true,
  referenceOnly: false,
  signedEdition: false,
  outOfPrint: false,
  fragile: false,
  archival: false,
  doNotRemoveFromLibrary: false,
  rareProtected: false,
  loanDaysDefault: 21,
  loanDaysRare: 7,
  requiresRareApproval: false,
  botanicalGenera: [],
  tags: [],
  notes: null,
  acquisitionNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseCopy: ItemCopy & { item: Item } = {
  id: "copy1",
  itemId: "item1",
  copyNumber: 1,
  barcode: "CACSS-1",
  shelfLocationId: null,
  conditionNotes: null,
  damaged: false,
  missing: false,
  donorId: null,
  acquisitionDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  item: baseItem,
};

describe("evaluateCheckoutEligibility", () => {
  it("allows checkout when eligible", () => {
    const r = evaluateCheckoutEligibility(baseCopy, 0, false);
    expect(r.ok).toBe(true);
  });

  it("blocks missing copies", () => {
    const r = evaluateCheckoutEligibility({ ...baseCopy, missing: true }, 0, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("copy_missing");
  });

  it("blocks when member at limit", () => {
    const r = evaluateCheckoutEligibility(baseCopy, MAX_ACTIVE_LOANS_MEMBER, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("member_limit");
  });

  it("blocks reference-only", () => {
    const r = evaluateCheckoutEligibility(
      { ...baseCopy, item: { ...baseItem, referenceOnly: true } },
      0,
      false,
    );
    expect(r.ok).toBe(false);
  });
});

describe("computeDueDate", () => {
  it("adds loan days", () => {
    const from = new Date("2026-01-01T12:00:00Z");
    const due = computeDueDate(from, 21);
    expect(due.getDate()).toBe(22);
  });
});

describe("isLoanOverdue", () => {
  it("detects overdue active loans", () => {
    expect(
      isLoanOverdue({
        status: "ACTIVE",
        dueDate: new Date("2020-01-01"),
        returnedAt: null,
      }),
    ).toBe(true);
  });

  it("ignores returned loans", () => {
    expect(
      isLoanOverdue({
        status: "RETURNED",
        dueDate: new Date("2020-01-01"),
        returnedAt: new Date(),
      }),
    ).toBe(false);
  });
});
