import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BackupPage() {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/patients");
  }

  redirect("/settings?tab=backup");
}
