import { requireRole } from "@/lib/authz";
import ScanDeskPageClient from "./scan-client";

export default async function ScanPage() {
  await requireRole(["LIBRARIAN", "ADMIN"]);
  return <ScanDeskPageClient />;
}
