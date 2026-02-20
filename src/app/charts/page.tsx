import { Suspense } from "react";
import ChartsPageClient from "./ChartsPageClient";
import ListEmptyState from "@/components/ui/ListEmptyState";

export const dynamic = "force-dynamic";

export default function ChartsPage() {
  return (
    <Suspense
      fallback={<ListEmptyState variant="loading" message="読み込み中..." />}
    >
      <ChartsPageClient />
    </Suspense>
  );
}
