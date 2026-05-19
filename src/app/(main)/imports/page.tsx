import { requireRole } from "@/lib/authz";
import ImportsPageClient from "./imports-client";

export default async function ImportsPage() {
  await requireRole(["LIBRARIAN", "ADMIN"]);
  return <ImportsPageClient />;
}
