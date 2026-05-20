import Link from "next/link";
import type { ReactNode } from "react";
import type { UserRole } from "@prisma/client";
import { Library, LayoutDashboard, Users, ScanLine, Upload, BarChart3, Tags, ShieldCheck, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { CacssLogo } from "@/components/cacss-logo";

const links: {
  href: string;
  label: string;
  icon: typeof Library;
  roles?: UserRole[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/catalog", label: "Catalog", icon: BookOpen },
  { href: "/loans", label: "Loans & holds", icon: Library },
  {
    href: "/imports",
    label: "Import",
    icon: Upload,
    roles: ["LIBRARIAN", "ADMIN"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["LIBRARIAN", "ADMIN"],
  },
  {
    href: "/scan",
    label: "Scan desk",
    icon: ScanLine,
    roles: ["LIBRARIAN", "ADMIN"],
  },
  {
    href: "/labels",
    label: "Labels",
    icon: Tags,
    roles: ["LIBRARIAN", "ADMIN"],
  },
  {
    href: "/members",
    label: "Members",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    href: "/approvals",
    label: "Rare approvals",
    icon: ShieldCheck,
    roles: ["ADMIN"],
  },
];

export function AppShell({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="border-b bg-card md:w-60 md:border-b-0 md:border-r md:shadow-soft">
        <div className="flex items-center justify-between gap-2 px-4 py-4 md:flex-col md:items-stretch">
          <CacssLogo href="/dashboard" size="md" tagline="Volunteer console" />
          <div className="flex items-center gap-2 md:w-full md:justify-between">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-4 md:flex-col md:overflow-visible">
          {links
            .filter((l) => !l.roles || l.roles.includes(role))
            .map(({ href, label, icon: Icon }) => (
              <Button
                key={href}
                variant="ghost"
                className={cn(
                  "justify-start gap-2 md:w-full",
                  "whitespace-nowrap",
                )}
                asChild
              >
                <Link href={href}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </Button>
            ))}
        </nav>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
