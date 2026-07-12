import { describe, expect, it } from "vitest";
import { escapeCsvField, sanitizeImportCell, sanitizeSpreadsheetCell } from "./csv-sanitize";

describe("sanitizeSpreadsheetCell", () => {
  it("prefixes formula injection characters", () => {
    expect(sanitizeSpreadsheetCell("=1+1")).toBe("'=1+1");
    expect(sanitizeSpreadsheetCell("+cmd")).toBe("'+cmd");
    expect(sanitizeSpreadsheetCell("-2+3")).toBe("'-2+3");
    expect(sanitizeSpreadsheetCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("leaves safe values unchanged", () => {
    expect(sanitizeSpreadsheetCell("Normal title")).toBe("Normal title");
  });
});

describe("escapeCsvField", () => {
  it("quotes fields with commas", () => {
    expect(escapeCsvField("Smith, Jane")).toBe('"Smith, Jane"');
  });
});

describe("sanitizeImportCell", () => {
  it("strips control characters", () => {
    expect(sanitizeImportCell("hello\x00world")).toBe("helloworld");
  });
});
