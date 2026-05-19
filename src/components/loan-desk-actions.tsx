"use client";

import { useTransition, useState } from "react";
import { returnLoan, renewLoan } from "@/actions/loans";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function LoanDeskActions({
  loanId,
  canRenew,
}: {
  loanId: string;
  canRenew: boolean;
}) {
  const [damage, setDamage] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !canRenew}
          onClick={() => {
            setMsg(null);
            start(async () => {
              try {
                await renewLoan(loanId);
                setMsg("Renewed.");
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Renew blocked.");
              }
            });
          }}
        >
          Renew
        </Button>
      </div>
      <Textarea
        placeholder="Damage notes on return (optional)"
        value={damage}
        onChange={(e) => setDamage(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            try {
              await returnLoan(loanId, damage);
              setDamage("");
              setMsg("Returned.");
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Return failed.");
            }
          });
        }}
      >
        Check in copy
      </Button>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
