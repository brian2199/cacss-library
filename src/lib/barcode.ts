export type BarcodeKind =
  | "internal"
  | "isbn10"
  | "isbn13"
  | "upc_a"
  | "ean13"
  | "unknown";

export type NormalizedBarcode = {
  raw: string;
  normalized: string;
  digits: string;
  kind: BarcodeKind;
  isValid: boolean;
};

/** Normalize scanner input (trim, strip control chars from USB wedges). */
export function normalizeScanInput(raw: string): string {
  return raw.replace(/[\r\n\t]/g, "").trim();
}

/** Digits-only form for ISBN / UPC comparisons. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * ISBN-10 check digit validation (optional filter before external lookup).
 */
export function isValidIsbn10(isbn10: string): boolean {
  const s = digitsOnly(isbn10);
  if (s.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const d = s[i];
    if (d === undefined || d < "0" || d > "9") return false;
    sum += Number(d) * (10 - i);
  }
  const check = s[9];
  if (check === undefined) return false;
  if (check === "X" || check === "x") return sum % 11 === 0;
  if (check < "0" || check > "9") return false;
  return (sum + Number(check)) % 11 === 0;
}

/**
 * ISBN-13 check digit validation.
 */
export function isValidIsbn13(isbn13: string): boolean {
  const s = digitsOnly(isbn13);
  if (s.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = s[i];
    if (d === undefined || d < "0" || d > "9") return false;
    sum += Number(d) * (i % 2 === 0 ? 1 : 3);
  }
  const check = s[12];
  if (check === undefined || check < "0" || check > "9") return false;
  return (10 - (sum % 10)) % 10 === Number(check);
}

/**
 * Build candidate ISBN strings from a scanned UPC/EAN/ISBN value.
 * Book UPCs are often EAN-13 with 978/979 prefix; 12-digit UPC-A maps to EAN-13 with leading 0.
 */
export function extractIsbnCandidates(barcode: string): string[] {
  const digits = digitsOnly(barcode);
  const out = new Set<string>();

  if (digits.length === 13) {
    out.add(digits);
    if (digits.startsWith("978") || digits.startsWith("979")) out.add(digits);
  }

  if (digits.length === 12) {
    out.add(`0${digits}`);
  }

  if (digits.length === 10) {
    out.add(digits);
  }

  if (digits.length === 9) {
    out.add(digits);
  }

  for (const candidate of [...out]) {
    if (candidate.length === 10 && isValidIsbn10(candidate)) out.add(candidate);
    if (candidate.length === 13 && isValidIsbn13(candidate)) out.add(candidate);
  }

  return [...out];
}

export function isLikelyBookBarcode(barcode: string): boolean {
  const digits = digitsOnly(barcode);
  if (digits.length === 10 || digits.length === 13) return true;
  if (digits.length === 12 || digits.length === 8) return true;
  return /^CACSS-/i.test(barcode.trim());
}

/** UPC-A (12-digit) check digit validation. */
export function isValidUpcA(upc: string): boolean {
  const s = digitsOnly(upc);
  if (s.length !== 12) return false;
  let odd = 0;
  let even = 0;
  for (let i = 0; i < 11; i++) {
    const d = Number(s[i]);
    if (!Number.isFinite(d)) return false;
    if (i % 2 === 0) odd += d;
    else even += d;
  }
  const check = (10 - ((odd * 3 + even) % 10)) % 10;
  return check === Number(s[11]);
}

/** EAN-13 check digit validation (includes book ISBN-13). */
export function isValidEan13(ean: string): boolean {
  return isValidIsbn13(ean);
}

/** Convert valid ISBN-10 to ISBN-13 (978 prefix). */
export function isbn10ToIsbn13(isbn10: string): string | null {
  const s = digitsOnly(isbn10);
  if (s.length !== 10 || !isValidIsbn10(s)) return null;
  const core = `978${s.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(core[i]);
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}

export function classifyBarcode(raw: string): NormalizedBarcode {
  const normalized = normalizeScanInput(raw);
  const digits = digitsOnly(normalized);

  if (/^CACSS-/i.test(normalized)) {
    return { raw, normalized, digits, kind: "internal", isValid: true };
  }

  if (digits.length === 10) {
    return {
      raw,
      normalized: digits,
      digits,
      kind: "isbn10",
      isValid: isValidIsbn10(digits),
    };
  }

  if (digits.length === 13) {
    const valid = isValidIsbn13(digits);
    const kind =
      digits.startsWith("978") || digits.startsWith("979") ? "isbn13" : "ean13";
    return { raw, normalized: digits, digits, kind, isValid: valid };
  }

  if (digits.length === 12) {
    return {
      raw,
      normalized: digits,
      digits,
      kind: "upc_a",
      isValid: isValidUpcA(digits),
    };
  }

  return { raw, normalized, digits, kind: "unknown", isValid: false };
}

/** Debounce key for suppressing duplicate scanner reads within a session. */
export function scanDedupeKey(code: string): string {
  return classifyBarcode(code).normalized.toUpperCase();
}
