import { Suspense } from "react";
import PatientsPageClient from "./PatientsPageClient";
import ListEmptyState from "@/components/ui/ListEmptyState";

export const dynamic = "force-dynamic";

export default function PatientsPage() {
  return (
    <Suspense
      fallback={<ListEmptyState variant="loading" message="読み込み中..." />}
    >
      <PatientsPageClient />
    </Suspense>
  );
}
