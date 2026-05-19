"use client";

import { useTransition, useState } from "react";
import { approveRareLoan, denyRareLoan } from "@/actions/loans";
import { Button } from "@/components/ui/button";

export function RareApprovalRow({ loanId }: { loanId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            try {
              await approveRareLoan(loanId);
              setMsg("Approved.");
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Failed.");
            }
          });
        }}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            try {
              await denyRareLoan(loanId);
              setMsg("Denied / cleared.");
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Failed.");
            }
          });
        }}
      >
        Deny
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
