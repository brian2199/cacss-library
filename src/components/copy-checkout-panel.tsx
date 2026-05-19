"use client";

import { useState, useTransition } from "react";
import { checkoutCopy } from "@/actions/loans";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CopyCheckoutPanel({
  copyId,
  members,
}: {
  copyId: string;
  members: { id: string; label: string }[];
}) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No borrower profiles found — seed members first.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          try {
            await checkoutCopy({ itemCopyId: copyId, memberProfileId: memberId });
            setMsg("Recorded. Refresh loans tab to see timers.");
          } catch (err) {
            setMsg(err instanceof Error ? err.message : "Unable to checkout.");
          }
        });
      }}
    >
      <div className="flex-1 space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Borrower
        </label>
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger>
            <SelectValue placeholder="Pick member" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Checkout desk"}
      </Button>
      {msg ? (
        <p className="text-sm text-muted-foreground sm:w-full">{msg}</p>
      ) : null}
    </form>
  );
}
