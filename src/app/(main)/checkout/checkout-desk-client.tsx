"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  createDeskMember,
  deskCheckoutBasket,
  deskReturnByBarcode,
  deskReturnByLoanId,
  resolveForCheckout,
  searchActiveLoansForReturn,
  searchBooksForCheckout,
  searchDeskMembers,
  selectItemForCheckout,
  type BasketItem,
  type BookSearchHit,
  type DeskMember,
  type ResolveForCheckoutResult,
  type ReturnSearchHit,
} from "@/actions/checkout-desk";
import { scanDedupeKey } from "@/lib/barcode";
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

type CheckoutConfirmation = {
  memberLabel: string;
  titles: string[];
  count: number;
};

export default function CheckoutDeskClient({
  members: initialMembers,
  initialTab = "checkout",
}: {
  members: DeskMember[];
  initialTab?: "checkout" | "return";
}) {
  const [tab, setTab] = useState(initialTab);
  const [members, setMembers] = useState(initialMembers);
  const [memberId, setMemberId] = useState(initialMembers[0]?.id ?? "");
  const [memberSearch, setMemberSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [bookMode, setBookMode] = useState<"scan" | "search">("scan");
  const [titleSearch, setTitleSearch] = useState("");
  const [searchHits, setSearchHits] = useState<BookSearchHit[]>([]);
  const [bookCode, setBookCode] = useState("");
  const [returnCode, setReturnCode] = useState("");
  const [returnSearch, setReturnSearch] = useState("");
  const [returnHits, setReturnHits] = useState<ReturnSearchHit[]>([]);
  const [resolved, setResolved] = useState<ResolveForCheckoutResult | null>(null);
  const [selectedCopyId, setSelectedCopyId] = useState("");
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [confirmation, setConfirmation] = useState<CheckoutConfirmation | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanFlash, setScanFlash] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wedgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanKey = useRef<{ key: string; at: number } | null>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  const checkoutSubmitting = useRef(false);

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.label.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.phone?.toLowerCase().includes(q) ?? false)
    );
  });

  const selectedMember = members.find((m) => m.id === memberId);

  const flashScan = (label: string) => {
    setScanFlash(label);
    window.setTimeout(() => setScanFlash(null), 800);
  };

  const isDuplicateScan = (code: string): boolean => {
    const key = scanDedupeKey(code);
    const now = Date.now();
    if (lastScanKey.current?.key === key && now - lastScanKey.current.at < 1500) {
      return true;
    }
    lastScanKey.current = { key, at: now };
    return false;
  };

  const addToBasket = useCallback((item: BasketItem) => {
    setBasket((prev) => {
      if (prev.some((b) => b.copyId === item.copyId)) {
        setError("That copy is already in the basket.");
        return prev;
      }
      setError(null);
      flashScan(`Added: ${item.title}`);
      return [...prev, item];
    });
  }, []);

  const removeFromBasket = (copyId: string) => {
    setBasket((prev) => prev.filter((b) => b.copyId !== copyId));
  };

  const applyReadyResult = (res: Extract<ResolveForCheckoutResult, { status: "ready" }>) => {
    if (res.copies.length === 1) {
      const c = res.copies[0]!;
      addToBasket({
        copyId: c.copyId,
        copyNumber: c.copyNumber,
        barcode: c.barcode,
        title: res.title,
        authors: res.authors,
        shelfHint: c.shelfHint,
        isSpecial: res.isSpecial,
        dueDatePreview: c.dueDatePreview,
      });
      setResolved(null);
      setBookCode("");
      bookInputRef.current?.focus();
      return;
    }
    setResolved(res);
    setSelectedCopyId("");
  };

  const runResolve = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      if (isDuplicateScan(trimmed)) return;

      setError(null);
      setMessage(null);
      start(async () => {
        try {
          const res = await resolveForCheckout(trimmed);
          if (res.status === "ready") {
            applyReadyResult(res);
          } else {
            setResolved(res);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Lookup failed.");
        }
      });
    },
    [addToBasket],
  );

  const handleBookInput = (value: string) => {
    setBookCode(value);
    if (wedgeTimer.current) clearTimeout(wedgeTimer.current);
    wedgeTimer.current = setTimeout(() => {
      if (value.trim().length >= 8) runResolve(value);
    }, 120);
  };

  const addResolvedCopyToBasket = () => {
    if (resolved?.status !== "ready" || !selectedCopyId) {
      setError("Select a copy to add.");
      return;
    }
    const copy = resolved.copies.find((c) => c.copyId === selectedCopyId);
    if (!copy) return;
    addToBasket({
      copyId: copy.copyId,
      copyNumber: copy.copyNumber,
      barcode: copy.barcode,
      title: resolved.title,
      authors: resolved.authors,
      shelfHint: copy.shelfHint,
      isSpecial: resolved.isSpecial,
      dueDatePreview: copy.dueDatePreview,
    });
    setResolved(null);
    setSelectedCopyId("");
    setBookCode("");
    bookInputRef.current?.focus();
  };

  const handleCompleteCheckout = () => {
    if (!memberId) {
      setError("Select a member first.");
      return;
    }
    if (!basket.length) {
      setError("Add at least one book to the basket.");
      return;
    }
    if (checkoutSubmitting.current) return;
    checkoutSubmitting.current = true;
    start(async () => {
      try {
        const res = await deskCheckoutBasket({
          itemCopyIds: basket.map((b) => b.copyId),
          memberProfileId: memberId,
        });
        setConfirmation({
          memberLabel: selectedMember?.label ?? "Member",
          titles: res.titles,
          count: res.count,
        });
        setBasket([]);
        setResolved(null);
        setMessage(res.message);
        setError(null);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? { ...m, activeLoans: m.activeLoans + res.count }
              : m,
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed.");
      } finally {
        checkoutSubmitting.current = false;
      }
    });
  };

  const runReturnSearch = () => {
    const q = returnSearch.trim();
    if (q.length < 2) {
      setError("Type at least 2 characters to search returns.");
      return;
    }
    setError(null);
    start(async () => {
      try {
        const hits = await searchActiveLoansForReturn(q);
        setReturnHits(hits);
        if (!hits.length) setError("No active loans match that search.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Return search failed.");
      }
    });
  };

  const returnFromSearchHit = (hit: ReturnSearchHit) => {
    start(async () => {
      try {
        const res = await deskReturnByLoanId(hit.loanId);
        setMessage(
          res.alreadyReturned
            ? (res.message ?? `Already returned: ${res.title}`)
            : (res.message ?? `Returned “${res.title}”.`),
        );
        setReturnHits((prev) => prev.filter((h) => h.loanId !== hit.loanId));
        setError(null);
        flashScan(`Returned: ${res.title}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Return failed.");
      }
    });
  };

  const runTitleSearch = () => {
    const q = titleSearch.trim();
    if (q.length < 2) {
      setError("Type at least 2 characters to search.");
      return;
    }
    setError(null);
    setSearchHits([]);
    start(async () => {
      try {
        const hits = await searchBooksForCheckout(q);
        setSearchHits(hits);
        if (hits.length === 0) {
          setError("No available copies match that search.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed.");
      }
    });
  };

  const pickSearchHit = (hit: BookSearchHit) => {
    setError(null);
    setMessage(null);
    start(async () => {
      try {
        const res = await selectItemForCheckout(hit.itemId);
        if (res.status === "ready") {
          applyReadyResult(res);
        } else {
          setResolved(res);
        }
        setBookCode("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load item.");
      }
    });
  };

  const handleAddMember = () => {
    start(async () => {
      try {
        const created = await createDeskMember({
          name: newName,
          email: newEmail,
          phone: newPhone || undefined,
        });
        setMembers((prev) =>
          [...prev, created.member].sort((a, b) => a.label.localeCompare(b.label)),
        );
        setMemberId(created.member.id);
        setNewName("");
        setNewEmail("");
        setNewPhone("");
        setShowAddMember(false);
        if (created.temporaryPassword) {
          setMessage(
            `Added ${created.member.label}. One-time password (share securely): ${created.temporaryPassword}`,
          );
        } else if (created.devPasswordHint) {
          setMessage(
            `Added ${created.member.label}. Development login uses the shared demo password documented in README.`,
          );
        } else {
          setMessage(`Added ${created.member.label}.`);
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add member.");
      }
    });
  };

  const handleReturn = () => {
    const code = returnCode.trim();
    if (!code) return;
    if (isDuplicateScan(code)) return;

    start(async () => {
      try {
        const res = await deskReturnByBarcode(code);
        if (res.alreadyReturned) {
          setMessage(res.message ?? `“${res.title}” was already returned.`);
        } else {
          setMessage(res.message ?? `Returned “${res.title}”.`);
          flashScan(`Returned: ${res.title}`);
        }
        setReturnCode("");
        setError(null);
        bookInputRef.current?.focus();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Return failed.");
      }
    });
  };

  const refreshMemberSearch = () => {
    const q = memberSearch.trim();
    if (q.length < 2) return;
    start(async () => {
      try {
        const results = await searchDeskMembers(q);
        if (results.length) setMembers(results);
      } catch {
        /* keep local filter */
      }
    });
  };

  const startNewSession = () => {
    setBasket([]);
    setConfirmation(null);
    setMessage(null);
    setError(null);
    setResolved(null);
    setBookCode("");
    bookInputRef.current?.focus();
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
          Select a member, scan or search books into the basket, then complete checkout once.
          Returns are idempotent — scanning an already-returned copy shows a friendly notice.
        </p>
      </div>

      {scanFlash ? (
        <div
          className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
          role="status"
          aria-live="polite"
        >
          {scanFlash}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "checkout" | "return")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="checkout">Check out</TabsTrigger>
          <TabsTrigger value="return">Return</TabsTrigger>
        </TabsList>

        <TabsContent value="checkout" className="mt-6 space-y-6">
          {confirmation ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle>Checkout complete</CardTitle>
                <CardDescription>
                  {confirmation.count} item{confirmation.count === 1 ? "" : "s"} checked out to{" "}
                  {confirmation.memberLabel}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-inside list-disc text-sm">
                  {confirmation.titles.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={startNewSession}>
                    Check out more
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setConfirmation(null);
                      setMemberId("");
                      setBasket([]);
                    }}
                  >
                    New member / session
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>1. Member</CardTitle>
              <CardDescription>Who is borrowing today?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search name, email, or phone…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                onBlur={refreshMemberSearch}
                onKeyDown={(e) => e.key === "Enter" && refreshMemberSearch()}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="borrower-select">Borrower</Label>
                  <Select value={memberId} onValueChange={setMemberId}>
                    <SelectTrigger id="borrower-select" className="h-11">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label} ({m.activeLoans} out
                          {m.overdueLoans ? `, ${m.overdueLoans} overdue` : ""})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedMember ? (
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">{selectedMember.label}</p>
                    <p className="text-muted-foreground">{selectedMember.email}</p>
                    {selectedMember.phone ? (
                      <p className="text-muted-foreground">{selectedMember.phone}</p>
                    ) : null}
                    <p className="mt-1 text-muted-foreground">
                      {selectedMember.activeLoans} out
                      {selectedMember.overdueLoans
                        ? ` · ${selectedMember.overdueLoans} overdue`
                        : ""}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="border-t pt-4">
                {showAddMember ? (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Quick add member</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="new-name">Full name</Label>
                        <Input
                          id="new-name"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Pat Smith"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new-email">Email</Label>
                        <Input
                          id="new-email"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="pat@example.com"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="new-phone">Phone (optional)</Label>
                        <Input
                          id="new-phone"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleAddMember}
                        disabled={pending || !newName.trim() || !newEmail.trim()}
                      >
                        {pending ? "Saving…" : "Save member"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowAddMember(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddMember(true)}
                  >
                    + Add new member
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Add books</CardTitle>
              <CardDescription>Scan barcodes or search by title — items go into the basket</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={bookMode}
                onValueChange={(v) => setBookMode(v as "scan" | "search")}
              >
                <TabsList>
                  <TabsTrigger value="scan">Scan barcode</TabsTrigger>
                  <TabsTrigger value="search">Search by name</TabsTrigger>
                </TabsList>
                <TabsContent value="scan" className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      ref={bookInputRef}
                      className="max-w-md font-mono"
                      placeholder="Scan book barcode…"
                      value={bookCode}
                      onChange={(e) => handleBookInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          runResolve(bookCode);
                        }
                      }}
                      autoComplete="off"
                      aria-label="Book barcode"
                    />
                    <Button
                      type="button"
                      onClick={() => runResolve(bookCode)}
                      disabled={pending}
                    >
                      {pending ? "Looking…" : "Find book"}
                    </Button>
                  </div>
                  <Scanner
                    onDetected={(code) => {
                      setBookCode(code);
                      runResolve(code);
                    }}
                  />
                </TabsContent>
                <TabsContent value="search" className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="max-w-lg"
                      placeholder="Book title or author…"
                      value={titleSearch}
                      onChange={(e) => setTitleSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runTitleSearch()}
                    />
                    <Button type="button" onClick={runTitleSearch} disabled={pending}>
                      {pending ? "Searching…" : "Search"}
                    </Button>
                  </div>
                  {searchHits.length > 0 ? (
                    <ul className="divide-y rounded-lg border">
                      {searchHits.map((hit) => (
                        <li key={hit.itemId}>
                          <button
                            type="button"
                            className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                            onClick={() => pickSearchHit(hit)}
                          >
                            <span>
                              <span className="font-medium">{hit.title}</span>
                              <span className="mt-0.5 block text-sm text-muted-foreground">
                                {hit.authors}
                                {hit.publicationYear ? ` · ${hit.publicationYear}` : ""}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2 text-sm">
                              {hit.isSpecial ? (
                                <Badge variant="bloom">Special</Badge>
                              ) : null}
                              <Badge variant="secondary">
                                {hit.availableCount} available
                              </Badge>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {resolved?.status === "ready" && resolved.copies.length > 1 ? (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-xl">{resolved.title}</CardTitle>
                <CardDescription>{resolved.authors} — pick a copy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                <Button type="button" onClick={addResolvedCopyToBasket} disabled={!selectedCopyId}>
                  Add to basket
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

          {resolved?.status === "unavailable" || resolved?.status === "not_found" ? (
            <Alert variant="destructive">
              <AlertTitle>
                {resolved.status === "not_found" ? "Not found" : "Cannot check out"}
              </AlertTitle>
              <AlertDescription>
                {resolved.status === "not_found" ? resolved.message : `${resolved.title} — ${resolved.reason}`}
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>3. Basket ({basket.length})</CardTitle>
              <CardDescription>Review before completing checkout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {basket.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Scan or search to add books. The basket stays until you complete checkout.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {basket.map((item) => (
                    <li
                      key={item.copyId}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.authors} · Copy #{item.copyNumber}
                          {item.barcode ? ` · ${item.barcode}` : ""}
                          {item.dueDatePreview
                            ? ` · due ${new Date(item.dueDatePreview).toLocaleDateString()}`
                            : ""}
                        </p>
                        {item.isSpecial ? (
                          <Badge variant="bloom" className="mt-1">
                            Special handling
                          </Badge>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromBasket(item.copyId)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto"
                onClick={handleCompleteCheckout}
                disabled={pending || !memberId || basket.length === 0}
              >
                {pending
                  ? "Checking out…"
                  : `Complete checkout (${basket.length} item${basket.length === 1 ? "" : "s"})`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="return" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Return by barcode</CardTitle>
              <CardDescription>
                Scan each copy as it comes back — already-returned copies show a notice, not an error
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-md font-mono"
                  placeholder="Scan return barcode…"
                  value={returnCode}
                  onChange={(e) => setReturnCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleReturn();
                    }
                  }}
                  aria-label="Return barcode"
                />
                <Button
                  type="button"
                  onClick={handleReturn}
                  disabled={pending || !returnCode.trim()}
                >
                  {pending ? "Processing…" : "Mark returned"}
                </Button>
              </div>
              <Scanner
                onDetected={(code) => {
                  setReturnCode(code);
                  if (isDuplicateScan(code)) return;
                  start(async () => {
                    try {
                      const res = await deskReturnByBarcode(code);
                      setMessage(
                        res.alreadyReturned
                          ? (res.message ?? `Already returned: ${res.title}`)
                          : (res.message ?? `Returned “${res.title}”.`),
                      );
                      setReturnCode("");
                      setError(null);
                      flashScan(`Returned: ${res.title}`);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Return failed.");
                    }
                  });
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Search when barcode is unreadable</CardTitle>
              <CardDescription>Find by member name, email, or book title</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-lg"
                  placeholder="Member or book title…"
                  value={returnSearch}
                  onChange={(e) => setReturnSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runReturnSearch()}
                />
                <Button type="button" variant="secondary" onClick={runReturnSearch} disabled={pending}>
                  Search loans
                </Button>
              </div>
              {returnHits.length > 0 ? (
                <ul className="divide-y rounded-lg border">
                  {returnHits.map((hit) => (
                    <li
                      key={hit.loanId}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{hit.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {hit.borrower} · Copy #{hit.copyNumber}
                          {hit.barcode ? ` · ${hit.barcode}` : ""}
                        </p>
                        <p
                          className={
                            hit.overdue
                              ? "text-sm font-medium text-destructive"
                              : "text-sm text-muted-foreground"
                          }
                        >
                          Due {new Date(hit.dueDate).toLocaleDateString()}
                          {hit.overdue ? " (overdue)" : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => returnFromSearchHit(hit)}
                        disabled={pending}
                      >
                        Mark returned
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
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
