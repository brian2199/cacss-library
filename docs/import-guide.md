# Import guide

## Supported formats

- `.csv`
- `.xlsx` / `.xls` (first sheet only)

Maximum file size: **5 MB**

## Workflow

1. **Download template** from `/imports`
2. **Preview** — validates headers and shows first 25 rows with duplicate warnings
3. **Confirm import** — writes valid rows; skips duplicates with a report

## Column aliases

The importer recognizes common header names:

`title`, `book title`, `author`, `authors`, `year`, `isbn`, `isbn13`, `upc`, `ean`, `barcode`, `copy barcode`, `format`, `publisher`, `notes`, `copy`

## Duplicate detection

Rows are skipped when:

- Copy barcode already exists
- ISBN matches an existing title
- Same normalized title + publication year

Re-uploading the **same file** (SHA-256 hash) shows a warning on preview; duplicates are still skipped row-by-row.

## Security

- Spreadsheet cells are sanitized on import (control chars stripped)
- Exported CSV values are escaped against formula injection (`=`, `+`, `-`, `@` prefixes)
- Filenames with path segments are rejected

## Enrichment

During import, missing ISBN/year/author may be enriched from Open Library / Google Books when a UPC/ISBN is present. Librarian-entered data is not overwritten when already populated.

## After import

New rows land in the **Imports inbox** category until staff recategorize them.
