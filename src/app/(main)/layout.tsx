import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/authz";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  return <AppShell role={session.user.role}>{children}</AppShell>;
}
