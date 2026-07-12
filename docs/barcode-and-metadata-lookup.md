# Barcode and metadata lookup

## Lookup order (checkout & scan)

1. **Exact local copy barcode** (`ItemCopy.barcode`)
2. **Local title ISBN** (normalized ISBN-10/13/UPC-derived)
3. **Open Library** API
4. **Google Books** API (fallback)
5. **Manual entry** (scan desk)

## Supported scan formats

| Format | Example | Notes |
|--------|---------|-------|
| Internal CACSS | `CACSS-001` | Physical copy ID |
| ISBN-10 | 10 digits + check | Validated check digit |
| ISBN-13 | 978/979… | Book EAN |
| UPC-A | 12 digits | Retail; may map to ISBN via 978 prefix |
| EAN-13 | 13 digits | Same validation as ISBN-13 when applicable |

Scanner wedges may include spaces, dashes, or trailing Enter — normalized before lookup.

## Title vs copy

- Scanning a **copy barcode** checks out that exact physical item.
- Scanning a **UPC/ISBN** finds the title; librarian picks or auto-adds an available copy.
- If the title exists but the barcode is new, use **Add another copy** (scan desk) — do not create duplicate titles.

## Metadata providers

Third-party results are **suggestions**. Librarians can edit all fields before saving. Providers may return incorrect matches for generic UPCs — always review before commit.

## Limitations

- UPC lookup does not guarantee a unique bibliographic match
- Measurements are not survey-grade — field-verify when shelf placement matters
- External APIs are not called during automated tests (mock in CI)
