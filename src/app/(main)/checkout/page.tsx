import { requireRole } from "@/lib/authz";
import { listDeskMembers } from "@/actions/checkout-desk";
import CheckoutDeskClient from "./checkout-desk-client";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["LIBRARIAN", "ADMIN"]);
  const sp = await searchParams;
  const members = await listDeskMembers();
  const initialTab = sp.tab === "return" ? "return" : "checkout";

  return <CheckoutDeskClient members={members} initialTab={initialTab} />;
}
