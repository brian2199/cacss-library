import { describe, expect, it } from "vitest";
import {
  classifyBarcode,
  digitsOnly,
  extractIsbnCandidates,
  isValidIsbn10,
  isValidIsbn13,
  isValidUpcA,
  isbn10ToIsbn13,
  normalizeScanInput,
  scanDedupeKey,
} from "./barcode";

describe("normalizeScanInput", () => {
  it("strips control characters from scanner wedges", () => {
    expect(normalizeScanInput("9780123456789\r\n")).toBe("9780123456789");
  });
});

describe("ISBN validation", () => {
  it("validates ISBN-10", () => {
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isValidIsbn10("0306406153")).toBe(false);
  });

  it("validates ISBN-13", () => {
    expect(isValidIsbn13("9780306406157")).toBe(true);
  });

  it("converts ISBN-10 to ISBN-13", () => {
    expect(isbn10ToIsbn13("0306406152")).toBe("9780306406157");
  });
});

describe("UPC validation", () => {
  it("validates UPC-A check digit", () => {
    expect(isValidUpcA("036000291452")).toBe(true);
  });
});

describe("classifyBarcode", () => {
  it("recognizes internal CACSS barcodes", () => {
    const r = classifyBarcode("CACSS-001");
    expect(r.kind).toBe("internal");
    expect(r.isValid).toBe(true);
  });

  it("classifies ISBN-13", () => {
    const r = classifyBarcode("978-0-306-40615-7");
    expect(r.kind).toBe("isbn13");
    expect(r.isValid).toBe(true);
  });
});

describe("extractIsbnCandidates", () => {
  it("derives ISBN from 12-digit UPC", () => {
    const candidates = extractIsbnCandidates("9780306406157");
    expect(candidates.some((c) => c.length === 13)).toBe(true);
  });
});

describe("scanDedupeKey", () => {
  it("normalizes equivalent scans", () => {
    expect(scanDedupeKey("978-0-306-40615-7")).toBe(
      scanDedupeKey("9780306406157"),
    );
  });
});

describe("digitsOnly", () => {
  it("removes non-digits", () => {
    expect(digitsOnly("ISBN 978-0-306-40615-7")).toBe("9780306406157");
  });
});
