import { isValidIsbn10, isValidIsbn13, digitsOnly } from "./barcode";
import type { ParsedImportRow } from "./import-rows";

export type ImportRowValidation = {
  status: "ok" | "warn" | "reject";
  messages: string[];
};

export function validateImportRow(row: ParsedImportRow): ImportRowValidation {
  const messages: string[] = [];

  if (!row.title.trim()) {
    return { status: "reject", messages: ["Missing title"] };
  }

  if (row.isbn) {
    const d = digitsOnly(row.isbn);
    if (d.length === 10 && !isValidIsbn10(d)) {
      messages.push("Invalid ISBN-10 check digit");
    } else if (d.length === 13 && !isValidIsbn13(d)) {
      messages.push("Invalid ISBN-13 check digit");
    } else if (d.length !== 10 && d.length !== 13) {
      messages.push("ISBN must be 10 or 13 digits");
    }
  }

  if (row.publicationYear !== undefined) {
    const y = row.publicationYear;
    if (!Number.isFinite(y) || y < 1400 || y > new Date().getFullYear() + 2) {
      messages.push("Publication year out of expected range");
    }
  }

  if (row.copyNumber < 1 || row.copyNumber > 999) {
    messages.push("Copy number must be between 1 and 999");
  }

  if (messages.some((m) => m.includes("Invalid ISBN"))) {
    return { status: "reject", messages };
  }

  if (messages.length) {
    return { status: "warn", messages };
  }

  return { status: "ok", messages: [] };
}
