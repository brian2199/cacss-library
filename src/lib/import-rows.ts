import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ItemFormat } from "@prisma/client";
import { digitsOnly, extractIsbnCandidates } from "@/lib/barcode";

export type ParsedImportRow = {
  rowNumber: number;
  title: string;
  subtitle?: string;
  authors: string[];
  publicationYear?: number;
  isbn?: string;
  upc?: string;
  barcode?: string;
  format: ItemFormat;
  publisher?: string;
  notes?: string;
  copyNumber: number;
};

export type SpreadsheetParseResult = {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: ParsedImportRow[];
  skippedEmpty: number;
};

function pick(raw: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const v = raw[key];
    if (v !== undefined && String(v).trim()) return String(v).trim();
  }
  return "";
}

function parseFormat(raw: Record<string, string>): ItemFormat {
  const formatRaw = pick(raw, [
    "format",
    "Format",
    "FORMAT",
    "type",
    "Type",
    "media",
  ]).toUpperCase();
  const formatValues = new Set<string>(Object.values(ItemFormat));
  return formatValues.has(formatRaw) ? (formatRaw as ItemFormat) : ItemFormat.BOOK;
}

function parseAuthors(authorRaw: string): string[] {
  const names = authorRaw
    .split(/[;/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return names.length ? names : ["Unknown"];
}

function resolveIsbn(raw: Record<string, string>): string | undefined {
  const isbn = pick(raw, ["isbn", "ISBN", "isbn13", "ISBN13", "isbn_13"]);
  if (isbn) return digitsOnly(isbn) || isbn.trim();

  const upc = pick(raw, ["upc", "UPC", "ean", "EAN", "barcode", "Barcode", "BARCODE"]);
  if (!upc) return undefined;

  const candidates = extractIsbnCandidates(upc);
  return (
    candidates.find((c) => c.length === 13 || c.length === 10) ??
    (digitsOnly(upc) || undefined)
  );
}

export function parseImportRow(
  raw: Record<string, string>,
  rowNumber: number,
): ParsedImportRow | null {
  const title = pick(raw, [
    "title",
    "Title",
    "TITLE",
    "name",
    "Name",
    "Item",
    "item",
    "book",
    "Book",
  ]);
  if (!title) return null;

  const authorRaw = pick(raw, [
    "author",
    "Author",
    "authors",
    "Authors",
    "author_s",
    "writer",
  ]);
  const yearStr = pick(raw, [
    "year",
    "Year",
    "publication_year",
    "Published",
    "pub_year",
    "copyright",
  ]);
  const publicationYear = yearStr ? Number(yearStr) : undefined;

  const upc = pick(raw, ["upc", "UPC", "ean", "EAN"]);
  const barcode =
    pick(raw, ["barcode", "Barcode", "copy_barcode", "shelf_barcode"]) || upc || undefined;

  const copyStr = pick(raw, ["copy", "copy_number", "copyNumber", "Copy"]);
  const copyNumber = copyStr ? Math.max(1, Number(copyStr) || 1) : 1;

  return {
    rowNumber,
    title,
    subtitle: pick(raw, ["subtitle", "Subtitle"]) || undefined,
    authors: parseAuthors(authorRaw || "Unknown"),
    publicationYear: Number.isFinite(publicationYear) ? publicationYear : undefined,
    isbn: resolveIsbn(raw),
    upc: upc ? digitsOnly(upc) || upc : undefined,
    barcode,
    format: parseFormat(raw),
    publisher: pick(raw, ["publisher", "Publisher"]) || undefined,
    notes: pick(raw, ["notes", "Notes", "comment", "comments"]) || undefined,
    copyNumber,
  };
}

export function parseSpreadsheetBuffer(
  buf: Buffer,
  filename: string,
): SpreadsheetParseResult {
  const lower = filename.toLowerCase();
  let rows: Record<string, string>[] = [];
  let sheetName: string | undefined;

  if (lower.endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, string>>(buf.toString("utf8"), {
      header: true,
      skipEmptyLines: true,
    });
    rows = parsed.data;
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
  } else {
    throw new Error("Use CSV or Excel (.xlsx, .xls).");
  }

  const headers =
    rows.length > 0
      ? Object.keys(rows[0] ?? {})
      : [];

  let skippedEmpty = 0;
  const parsed: ParsedImportRow[] = [];

  rows.forEach((raw, idx) => {
    const row = parseImportRow(raw, idx + 2);
    if (!row) {
      skippedEmpty++;
      return;
    }
    parsed.push(row);
  });

  return { filename, sheetName, headers, rows: parsed, skippedEmpty };
}

export const IMPORT_TEMPLATE_CSV = `title,author,year,isbn,upc,barcode,format,publisher,notes,copy
Example Cactus Field Guide,Jane Botanist,2018,9781234567890,9781234567890,9781234567890,BOOK,Desert Press,Optional shelf note,1
`;
