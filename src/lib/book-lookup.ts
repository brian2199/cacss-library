import { extractIsbnCandidates } from "@/lib/barcode";

export type BookLookupMetadata = {
  title: string;
  subtitle?: string;
  authors: string[];
  isbn?: string;
  publicationYear?: number;
  publisher?: string;
  pageCount?: number;
  coverUrl?: string;
  source: "openlibrary" | "googlebooks";
};

const USER_AGENT = "CACSS-Library/1.0 (volunteer catalog; contact: library@cacss.local)";

function parseYear(value: unknown): number | undefined {
  if (typeof value === "number" && value > 0) return value;
  if (typeof value === "string") {
    const m = value.match(/\d{4}/);
    if (m) return Number(m[0]);
  }
  return undefined;
}

async function lookupOpenLibrary(isbn: string): Promise<BookLookupMetadata | null> {
  const clean = isbn.replace(/\D/g, "");
  const res = await fetch(`https://openlibrary.org/isbn/${clean}.json`, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    title?: string;
    subtitle?: string;
    publishers?: string[];
    publish_date?: string;
    number_of_pages?: number;
    authors?: { name?: string; key?: string }[];
    covers?: number[];
  };

  if (!data.title?.trim()) return null;

  const authors: string[] = [];
  if (data.authors?.length) {
    for (const a of data.authors.slice(0, 5)) {
      if (a.name) authors.push(a.name);
      else if (a.key) {
        try {
          const ar = await fetch(`https://openlibrary.org${a.key}.json`, {
            headers: { "User-Agent": USER_AGENT },
            next: { revalidate: 86400 },
          });
          if (ar.ok) {
            const aj = (await ar.json()) as { name?: string };
            if (aj.name) authors.push(aj.name);
          }
        } catch {
          /* skip author fetch */
        }
      }
    }
  }

  const coverId = data.covers?.[0];
  return {
    title: data.title.trim(),
    subtitle: data.subtitle?.trim(),
    authors: authors.length ? authors : ["Unknown"],
    isbn: clean.length === 13 ? clean : clean.length === 10 ? clean : undefined,
    publicationYear: parseYear(data.publish_date),
    publisher: data.publishers?.[0],
    pageCount: data.number_of_pages,
    coverUrl: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg`,
    source: "openlibrary",
  };
}

async function lookupGoogleBooks(isbn: string): Promise<BookLookupMetadata | null> {
  const clean = isbn.replace(/\D/g, "");
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(clean)}&maxResults=1`,
    { headers: { "User-Agent": USER_AGENT }, next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    items?: {
      volumeInfo?: {
        title?: string;
        subtitle?: string;
        authors?: string[];
        publisher?: string;
        publishedDate?: string;
        pageCount?: number;
        industryIdentifiers?: { type?: string; identifier?: string }[];
        imageLinks?: { thumbnail?: string };
      };
    }[];
  };

  const info = data.items?.[0]?.volumeInfo;
  if (!info?.title?.trim()) return null;

  const id =
    info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ??
    info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ??
    clean;

  return {
    title: info.title.trim(),
    subtitle: info.subtitle?.trim(),
    authors: info.authors?.length ? info.authors : ["Unknown"],
    isbn: id.replace(/\D/g, "") || clean,
    publicationYear: parseYear(info.publishedDate),
    publisher: info.publisher,
    pageCount: info.pageCount,
    coverUrl: info.imageLinks?.thumbnail,
    source: "googlebooks",
  };
}

/** Resolve bibliographic metadata from UPC/EAN/ISBN using free public APIs. */
export async function lookupBookMetadata(
  barcodeOrIsbn: string,
): Promise<BookLookupMetadata | null> {
  const candidates = extractIsbnCandidates(barcodeOrIsbn);
  if (!candidates.length) {
    const digits = barcodeOrIsbn.replace(/\D/g, "");
    if (digits.length >= 10) candidates.push(digits);
  }

  for (const isbn of candidates) {
    const ol = await lookupOpenLibrary(isbn);
    if (ol) return ol;
    const gb = await lookupGoogleBooks(isbn);
    if (gb) return gb;
  }

  return null;
}
