"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  deskCheckout,
  deskReturnByBarcode,
  resolveForCheckout,
  type DeskMember,
  type ResolveForCheckoutResult,
} from "@/actions/checkout-desk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Scanner = dynamic(() => import("@/components/html5-barcode-scanner"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading camera…</p>,
});

export default function CheckoutDeskClient({
  members,
  initialTab = "checkout",
}: {
  members: DeskMember[];
  initialTab?: "checkout" | "return";
}) {
  const [tab, setTab] = useState(initialTab);
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [memberSearch, setMemberSearch] = useState("");
  const [bookCode, setBookCode] = useState("");
  const [returnCode, setReturnCode] = useState("");
  const [resolved, setResolved] = useState<ResolveForCheckoutResult | null>(null);
  const [selectedCopyId, setSelectedCopyId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wedgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.label.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });

  const selectedMember = members.find((m) => m.id === memberId);

  const runResolve = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    setMessage(null);
    setResolved(null);
    start(async () => {
      try {
        const res = await resolveForCheckout(trimmed);
        setResolved(res);
        if (res.status === "ready" && res.copies.length === 1) {
          setSelectedCopyId(res.copies[0]!.copyId);
        } else {
          setSelectedCopyId("");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lookup failed.");
      }
    });
  }, []);

  const handleBookInput = (value: string) => {
    setBookCode(value);
    if (wedgeTimer.current) clearTimeout(wedgeTimer.current);
    wedgeTimer.current = setTimeout(() => {
      if (value.trim().length >= 8) runResolve(value);
    }, 120);
  };

  const handleCheckout = () => {
    if (!memberId) {
      setError("Select a member first.");
      return;
    }
    if (!selectedCopyId) {
      setError("Select a copy to check out.");
      return;
    }
    start(async () => {
      try {
        const res = await deskCheckout({
          itemCopyId: selectedCopyId,
          memberProfileId: memberId,
        });
        setMessage(res.message);
        setBookCode("");
        setResolved(null);
        setSelectedCopyId("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed.");
      }
    });
  };

  const handleReturn = () => {
    start(async () => {
      try {
        const res = await deskReturnByBarcode(returnCode);
        setMessage(`Returned “${res.title}” from ${res.borrower}.`);
        setReturnCode("");
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Return failed.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Circulation desk
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
          Check out & return
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Pick the member, scan the book barcode, and check out in one place. Most books are standard
          loans — rare titles may need admin approval after checkout.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "checkout" | "return")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="checkout">Check out</TabsTrigger>
          <TabsTrigger value="return">Return</TabsTrigger>
        </TabsList>

        <TabsContent value="checkout" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Member</CardTitle>
              <CardDescription>Who is borrowing today?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search name or email…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Borrower</Label>
                  <Select value={memberId} onValueChange={setMemberId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label} ({m.activeLoans} out)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedMember ? (
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">{selectedMember.label}</p>
                    <p className="text-muted-foreground">{selectedMember.email}</p>
                    <p className="mt-1 text-muted-foreground">
                      {selectedMember.activeLoans} book
                      {selectedMember.activeLoans === 1 ? "" : "s"} currently out
                    </p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Book</CardTitle>
              <CardDescription>Scan UPC, ISBN, or copy barcode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-md font-mono"
                  placeholder="Scan book barcode…"
                  value={bookCode}
                  onChange={(e) => handleBookInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runResolve(bookCode)}
                  autoFocus
                />
                <Button type="button" onClick={() => runResolve(bookCode)} disabled={pending}>
                  {pending ? "Looking…" : "Find book"}
                </Button>
              </div>
              <Scanner
                onDetected={(code) => {
                  setBookCode(code);
                  runResolve(code);
                }}
              />
            </CardContent>
          </Card>

          {resolved?.status === "ready" ? (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-xl">{resolved.title}</CardTitle>
                <CardDescription>{resolved.authors}</CardDescription>
                {resolved.isSpecial ? (
                  <Badge variant="bloom" className="w-fit">
                    Special handling — review due date & rules
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {resolved.copies.length > 1 ? (
                  <div className="space-y-2">
                    <Label>Which copy?</Label>
                    <Select value={selectedCopyId} onValueChange={setSelectedCopyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select copy" />
                      </SelectTrigger>
                      <SelectContent>
                        {resolved.copies.map((c) => (
                          <SelectItem key={c.copyId} value={c.copyId}>
                            Copy #{c.copyNumber}
                            {c.barcode ? ` · ${c.barcode}` : ""}
                            {c.shelfHint ? ` · ${c.shelfHint}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Copy #{resolved.copies[0]?.copyNumber}
                    {resolved.copies[0]?.barcode
                      ? ` · ${resolved.copies[0].barcode}`
                      : ""}
                  </p>
                )}
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={handleCheckout}
                  disabled={pending || !memberId}
                >
                  {pending ? "Checking out…" : "Check out to member"}
                </Button>
                <Button variant="link" asChild className="px-0">
                  <Link href={`/catalog/${resolved.itemId}`}>View full record</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {resolved?.status === "on_loan" ? (
            <Alert>
              <AlertTitle>Already checked out</AlertTitle>
              <AlertDescription>
                <strong>{resolved.title}</strong> is out to {resolved.borrower} until{" "}
                {new Date(resolved.dueDate).toLocaleDateString()}.
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setTab("return");
                    setReturnCode(resolved.barcode ?? bookCode);
                  }}
                >
                  Switch to return
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {resolved?.status === "unavailable" ? (
            <Alert variant="destructive">
              <AlertTitle>Cannot check out</AlertTitle>
              <AlertDescription>
                <strong>{resolved.title}</strong> — {resolved.reason}
              </AlertDescription>
            </Alert>
          ) : null}

          {resolved?.status === "not_found" ? (
            <Alert variant="destructive">
              <AlertTitle>Not found</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{resolved.message}</p>
                <p className="flex flex-wrap gap-3 text-sm">
                  <Link href="/scan" className="font-medium text-primary underline-offset-4 hover:underline">
                    Add via scan
                  </Link>
                  <Link href="/imports" className="font-medium text-primary underline-offset-4 hover:underline">
                    Import spreadsheet
                  </Link>
                </p>
              </AlertDescription>
            </Alert>
          ) : null}
        </TabsContent>

        <TabsContent value="return" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Return by barcode</CardTitle>
              <CardDescription>Scan the copy barcode on the book being returned</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-md font-mono"
                  placeholder="Scan return barcode…"
                  value={returnCode}
                  onChange={(e) => setReturnCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleReturn()}
                />
                <Button type="button" onClick={handleReturn} disabled={pending || !returnCode.trim()}>
                  {pending ? "Processing…" : "Mark returned"}
                </Button>
              </div>
              <Scanner
                onDetected={(code) => {
                  setReturnCode(code);
                  start(async () => {
                    try {
                      const res = await deskReturnByBarcode(code);
                      setMessage(`Returned “${res.title}” from ${res.borrower}.`);
                      setReturnCode("");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Return failed.");
                    }
                  });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {message ? (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Problem</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Adding new titles? Use{" "}
        <Link href="/scan" className="font-medium text-primary underline-offset-4 hover:underline">
          Scan desk
        </Link>{" "}
        or{" "}
        <Link href="/imports" className="font-medium text-primary underline-offset-4 hover:underline">
          Imports
        </Link>
        .
      </p>
    </div>
  );
}
