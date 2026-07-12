import { describe, expect, it } from "vitest";
import { validateImportRow } from "./import-validate";
import { ItemFormat } from "@prisma/client";

describe("validateImportRow", () => {
  it("rejects missing title", () => {
    const r = validateImportRow({
      rowNumber: 1,
      title: "",
      authors: ["Unknown"],
      format: ItemFormat.BOOK,
      copyNumber: 1,
    });
    expect(r.status).toBe("reject");
  });

  it("accepts valid row", () => {
    const r = validateImportRow({
      rowNumber: 1,
      title: "Cactus Guide",
      authors: ["Jane Botanist"],
      isbn: "9780306406157",
      publicationYear: 2018,
      format: ItemFormat.BOOK,
      copyNumber: 1,
    });
    expect(r.status).toBe("ok");
  });

  it("rejects invalid ISBN check digit", () => {
    const r = validateImportRow({
      rowNumber: 2,
      title: "Bad ISBN Book",
      authors: ["Author"],
      isbn: "9780306406150",
      format: ItemFormat.BOOK,
      copyNumber: 1,
    });
    expect(r.status).toBe("reject");
  });
});
