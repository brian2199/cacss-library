"use client";

import { useState, useTransition } from "react";
import { importSpreadsheetBuffer, previewPdfText } from "@/actions/import";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ImportsPageClient() {
  const [sheetMsg, setSheetMsg] = useState<string | null>(null);
  const [pdfLines, setPdfLines] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

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
          Bring forward Periodicals / Journals / Book list spreadsheets (CSV & Excel). PDF exports preview as text so volunteers can plan OCR-ready normalization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV / Excel ingest</CardTitle>
          <CardDescription>
            Flexible headers: title, author, year, isbn, format, barcode. Duplicate ISBN or matching title+year rows skip automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setSheetMsg(null);
              start(async () => {
                try {
                  const res = await importSpreadsheetBuffer(fd);
                  setSheetMsg(
                    `Imported ${res.created} rows — skipped ${res.skippedDup} suspected duplicates.`,
                  );
                  e.currentTarget.reset();
                } catch (err) {
                  setSheetMsg(
                    err instanceof Error ? err.message : "Import failed.",
                  );
                }
              });
            }}
          >
            <input type="file" name="file" accept=".csv,.xlsx,.xls" required />
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Run importer"}
            </Button>
          </form>
          {sheetMsg ? (
            <Alert className="mt-4">
              <AlertTitle>Result</AlertTitle>
              <AlertDescription>{sheetMsg}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PDF preview (Phase 1)</CardTitle>
          <CardDescription>
            Extracts embedded text for mapping exercises — scanned-only PDFs need future OCR microservice hooks.
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
