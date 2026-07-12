import { requireRole } from "@/lib/authz";
import CheckoutDeskClient from "./checkout-desk-client";
import { listDeskMembers } from "@/actions/checkout-desk";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["LIBRARIAN", "ADMIN"]);
  const members = await listDeskMembers();
  const params = await searchParams;
  const initialTab = params.tab === "return" ? "return" : "checkout";

  return <CheckoutDeskClient members={members} initialTab={initialTab} />;
}
