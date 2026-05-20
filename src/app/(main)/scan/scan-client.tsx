"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Scanner = dynamic(() => import("@/components/html5-barcode-scanner"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-muted-foreground">Preparing camera bridge…</p>
  ),
});

export default function ScanDeskPageClient() {
  const router = useRouter();
  const [manual, setManual] = useState("");

  const go = useCallback(
    (barcode: string) => {
      const trimmed = barcode.trim();
      if (!trimmed) return;
      router.push(`/catalog?barcode=${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

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
          Look up UPC/ISBN and add new titles. To check books out to members, use the{" "}
          <a href="/checkout" className="font-medium text-primary underline-offset-4 hover:underline">
            Checkout desk
          </a>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manual entry</CardTitle>
          <CardDescription>For wedges & bluetooth scanners acting as keyboards.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="CACSS-..."
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") go(manual);
            }}
            className="max-w-md"
          />
          <Button type="button" onClick={() => go(manual)}>
            Open catalog match
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Camera reader</CardTitle>
          <CardDescription>
            Grants temporary browser access — HTTPS deployments only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Scanner onDetected={go} />
        </CardContent>
      </Card>
    </div>
  );
}
