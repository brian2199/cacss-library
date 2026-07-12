import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CatalogNotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Title not found
      </h1>
      <p className="text-muted-foreground">
        That catalog record may have been removed or the link is incorrect.
      </p>
      <Button asChild>
        <Link href="/catalog">Back to catalog</Link>
      </Button>
    </div>
  );
}
