"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  resolveBarcode,
  addItemFromScan,
  addCopyBarcode,
  type ResolveBarcodeResult,
} from "@/actions/scan";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const Scanner = dynamic(() => import("@/components/html5-barcode-scanner"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-muted-foreground">Preparing camera…</p>
  ),
});

export default function ScanDeskPageClient() {
  const router = useRouter();
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ResolveBarcodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wedgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editAuthors, setEditAuthors] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editIsbn, setEditIsbn] = useState("");
  const [editPublisher, setEditPublisher] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const applyLookupToForm = useCallback((r: Extract<ResolveBarcodeResult, { status: "lookup" }>) => {
    const m = r.metadata;
    setEditTitle(m.title);
    setEditAuthors(m.authors.join("; "));
    setEditYear(m.publicationYear?.toString() ?? "");
    setEditIsbn(m.isbn ?? "");
    setEditPublisher(m.publisher ?? "");
    setEditNotes("");
  }, []);

  const runResolve = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setError(null);
      setResult(null);
      start(async () => {
        try {
          const res = await resolveBarcode(trimmed);
          setResult(res);
          if (res.status === "lookup") applyLookupToForm(res);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Scan failed.");
        }
      });
    },
    [applyLookupToForm],
  );

  const handleWedgeInput = (value: string) => {
    setManual(value);
    if (wedgeTimer.current) clearTimeout(wedgeTimer.current);
    wedgeTimer.current = setTimeout(() => {
      if (value.trim().length >= 8) runResolve(value);
    }, 120);
  };

  const handleAddFromLookup = () => {
    if (result?.status !== "lookup") return;
    start(async () => {
      try {
        const created = await addItemFromScan({
          barcode: result.barcode,
          title: editTitle,
          authors: editAuthors
            .split(/[;/]/)
            .map((s) => s.trim())
            .filter(Boolean),
          isbn: editIsbn || result.metadata.isbn,
          publicationYear: editYear ? Number(editYear) : result.metadata.publicationYear,
          publisher: editPublisher || result.metadata.publisher,
          pageCount: result.metadata.pageCount,
          notes: editNotes || undefined,
        });
        router.push(`/catalog/${created.itemId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add item.");
      }
    });
  };

  const handleAddCopy = () => {
    if (result?.status !== "local_isbn") return;
    const barcode = manual.trim();
    if (!barcode) {
      setError("Scan or enter the barcode for the new copy first.");
      return;
    }
    start(async () => {
      try {
        await addCopyBarcode(result.itemId, barcode);
        router.push(`/catalog/${result.itemId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add copy.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Cataloging
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Add books (scan)
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Scan UPC or ISBN to look up title data (Open Library & Google Books) and add new volumes.
          To check books out to members, use the{" "}
          <Link href="/checkout" className="font-medium text-primary underline-offset-4 hover:underline">
            Checkout desk
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scanner input</CardTitle>
          <CardDescription>
            USB scanners work as keyboards — focus this field and scan. Camera supports UPC/EAN and QR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="UPC, ISBN, or CACSS-…"
              value={manual}
              onChange={(e) => handleWedgeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runResolve(manual);
              }}
              className="max-w-md font-mono"
              autoFocus
            />
            <Button type="button" onClick={() => runResolve(manual)} disabled={pending}>
              {pending ? "Looking up…" : "Resolve"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setManual("");
                setResult(null);
                setError(null);
              }}
            >
              Clear
            </Button>
          </div>
          <Scanner
            onDetected={(code) => {
              setManual(code);
              runResolve(code);
            }}
          />
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result?.status === "local_copy" ? (
        <Alert>
          <AlertTitle>In catalog (copy barcode)</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              <strong>{result.title}</strong> — barcode{" "}
              <code className="text-xs">{result.barcode}</code>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/catalog/${result.itemId}`}>Open record</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/checkout">Check out to member</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {result?.status === "local_isbn" ? (
        <Alert>
          <AlertTitle>ISBN already in catalog</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              <strong>{result.title}</strong> (ISBN {result.isbn})
            </p>
            <p className="text-sm text-muted-foreground">
              This scan is not on a copy yet. Add a new copy with the scanned barcode, or open the record.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/catalog/${result.itemId}`}>Open record</Link>
              </Button>
              <Button type="button" variant="secondary" onClick={handleAddCopy} disabled={pending}>
                Add copy with scanned barcode
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {result?.status === "lookup" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Found via {result.metadata.source === "openlibrary" ? "Open Library" : "Google Books"}
              <Badge variant="secondary">New to catalog</Badge>
            </CardTitle>
            <CardDescription>
              Review fields, then add with barcode <code className="text-xs">{result.barcode}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.metadata.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.metadata.coverUrl}
                alt=""
                className="h-40 w-auto rounded-md border object-cover"
              />
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="scan-title">Title</Label>
                <Input id="scan-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="scan-authors">Authors (semicolon-separated)</Label>
                <Input
                  id="scan-authors"
                  value={editAuthors}
                  onChange={(e) => setEditAuthors(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scan-year">Year</Label>
                <Input id="scan-year" value={editYear} onChange={(e) => setEditYear(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scan-isbn">ISBN</Label>
                <Input id="scan-isbn" value={editIsbn} onChange={(e) => setEditIsbn(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="scan-publisher">Publisher</Label>
                <Input
                  id="scan-publisher"
                  value={editPublisher}
                  onChange={(e) => setEditPublisher(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="scan-notes">Notes (optional)</Label>
                <Textarea id="scan-notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
            </div>
            <Button type="button" onClick={handleAddFromLookup} disabled={pending || !editTitle.trim()}>
              {pending ? "Saving…" : "Add to catalog"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {result?.status === "not_found" ? (
        <Alert variant="destructive">
          <AlertTitle>Not found</AlertTitle>
          <AlertDescription>
            <p>{result.message}</p>
            <p className="mt-2 font-mono text-xs">{result.barcode}</p>
            <Button className="mt-3" variant="secondary" asChild>
              <Link href="/imports">Import via CSV / Excel</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
