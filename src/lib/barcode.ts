/** Normalize scanner input (trim, strip control chars from USB wedges). */
export function normalizeScanInput(raw: string): string {
  return raw.replace(/[\r\n\t]/g, "").trim();
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Build candidate ISBN strings from a scanned UPC/EAN/ISBN value. */
export function extractIsbnCandidates(barcode: string): string[] {
  const digits = digitsOnly(barcode);
  const out = new Set<string>();

  if (digits.length === 13) out.add(digits);
  if (digits.length === 12) out.add(`0${digits}`);
  if (digits.length === 10) out.add(digits);

  return [...out];
}
