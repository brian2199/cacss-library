"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cacss-library]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 p-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        The library console hit an unexpected problem. Try again, or contact a volunteer if it
        keeps happening.
      </p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
