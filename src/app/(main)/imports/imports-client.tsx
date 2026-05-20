"use client";

import { useState, useTransition } from "react";
import {
  importSpreadsheetBuffer,
  previewSpreadsheet,
  previewPdfText,
  getImportTemplateCsv,
} from "@/actions/import";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PreviewRow = {
  row: number;
  title: string;
  authors: string;
  year?: number;
  isbn?: string;
  upc?: string;
  barcode?: string;
  format: string;
};

export default function ImportsPageClient() {
  const [sheetMsg, setSheetMsg] = useState<string | null>(null);
  const [sheetErrors, setSheetErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    totalRows: number;
    headers: string[];
    rows: PreviewRow[];
  } | null>(null);
  const [pdfLines, setPdfLines] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  const downloadTemplate = () => {
    start(async () => {
      try {
        const csv = await getImportTemplateCsv();
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cacss-import-template.csv";
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setSheetMsg(err instanceof Error ? err.message : "Could not load template.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Legacy inventories
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Imports
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Bring forward book lists via CSV or Excel. Columns can include UPC/EAN — we derive ISBN when
          possible and optionally enrich missing fields from Open Library during import.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV / Excel ingest</CardTitle>
          <CardDescription>
            Headers: title, author, year, isbn, upc, barcode, format, publisher, notes, copy. Preview
            before import. Duplicate ISBN, title+year, or barcode rows are skipped with a report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" onClick={downloadTemplate} disabled={pending}>
            Download template CSV
          </Button>

          <form
            className="space-y-4 rounded-lg border border-dashed p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setSheetMsg(null);
              setSheetErrors([]);
              start(async () => {
                try {
                  const res = await previewSpreadsheet(fd);
                  setPreview({
                    totalRows: res.totalRows,
                    headers: res.headers,
                    rows: res.preview as PreviewRow[],
                  });
                  setSheetMsg(
                    `Preview: ${res.totalRows} data rows (${res.skippedEmpty} empty lines skipped). Headers: ${res.headers.join(", ") || "(none)"}`,
                  );
                } catch (err) {
                  setPreview(null);
                  setSheetMsg(err instanceof Error ? err.message : "Preview failed.");
                }
              });
            }}
          >
            <p className="text-sm font-medium">Step 1 — Preview</p>
            <input type="file" name="file" accept=".csv,.xlsx,.xls" required />
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Parsing…" : "Preview file"}
            </Button>
          </form>

          {preview ? (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Authors</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>ISBN</TableHead>
                    <TableHead>UPC</TableHead>
                    <TableHead>Barcode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.title}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{r.authors}</TableCell>
                      <TableCell>{r.year ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.isbn ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.upc ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.barcode ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.totalRows > preview.rows.length ? (
                <p className="p-2 text-xs text-muted-foreground">
                  Showing first {preview.rows.length} of {preview.totalRows} rows.
                </p>
              ) : null}
            </div>
          ) : null}

          <form
            className="space-y-4 rounded-lg border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setSheetMsg(null);
              setSheetErrors([]);
              start(async () => {
                try {
                  const res = await importSpreadsheetBuffer(fd);
                  setSheetMsg(
                    `Imported ${res.created} rows — skipped ${res.skippedDup} duplicates, ${res.skippedEmpty} empty lines.`,
                  );
                  setSheetErrors(res.errors);
                  e.currentTarget.reset();
                  setPreview(null);
                } catch (err) {
                  setSheetMsg(err instanceof Error ? err.message : "Import failed.");
                }
              });
            }}
          >
            <p className="text-sm font-medium">Step 2 — Import</p>
            <input type="file" name="file" accept=".csv,.xlsx,.xls" required />
            <Button type="submit" disabled={pending}>
              {pending ? "Importing…" : "Run import"}
            </Button>
          </form>

          {sheetMsg ? (
            <Alert className="mt-4">
              <AlertTitle>Result</AlertTitle>
              <AlertDescription>{sheetMsg}</AlertDescription>
            </Alert>
          ) : null}

          {sheetErrors.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Row notes ({sheetErrors.length})</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {sheetErrors.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PDF preview (Phase 1)</CardTitle>
          <CardDescription>
            Extracts embedded text for mapping exercises — scanned-only PDFs need future OCR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setPdfLines(null);
              start(async () => {
                try {
                  const res = await previewPdfText(fd);
                  setPdfLines(res.lines);
                } catch (err) {
                  setPdfLines([
                    err instanceof Error ? err.message : "Unable to parse PDF.",
                  ]);
                }
              });
            }}
          >
            <input type="file" name="file" accept="application/pdf" required />
            <Button type="submit" variant="secondary" disabled={pending}>
              Preview text
            </Button>
          </form>
          {pdfLines ? (
            <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
              {pdfLines.join("\n")}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
