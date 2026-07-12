/** Allow only same-origin relative callback paths (open-redirect guard). */
export function sanitizeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/catalog",
): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  return trimmed;
}
