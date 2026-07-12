/** Prefix that neutralizes spreadsheet formula injection in exported cells. */
const FORMULA_PREFIX = "'";

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Sanitize a cell value before writing to CSV/Excel export.
 * Prevents formula injection when opened in Excel/Sheets.
 */
export function sanitizeSpreadsheetCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (FORMULA_START.test(s)) return `${FORMULA_PREFIX}${s}`;
  return s;
}

/** Escape a CSV field (quotes + formula guard). */
export function escapeCsvField(value: string | number | null | undefined): string {
  const sanitized = sanitizeSpreadsheetCell(value);
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/** Sanitize imported spreadsheet cell text (strip control chars, trim). */
export function sanitizeImportCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim();
}
