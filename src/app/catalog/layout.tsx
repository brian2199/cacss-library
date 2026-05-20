import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { CacssLogo } from "@/components/cacss-logo";
import { Button } from "@/components/ui/button";

export default async function CatalogLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/25 to-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <CacssLogo href="/" size="md" showLibraryLabel tagline="Public catalog" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" asChild size="sm">
              <Link href="/catalog">Catalog</Link>
            </Button>
            {session ? (
              <Button asChild size="sm">
                <Link href="/dashboard">Workspace</Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href="/login">Volunteer sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
