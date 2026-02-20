import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { LogsTabsClient } from "@/components/logs/LogsTabsClient";

export default async function LogsPage() {
  try {
    const user = await requireAuth();

    return (
      <div className="p-4 space-y-4">
        <PageHeader title="ログ" subtitle="操作記録と監査ログを確認" />
        <LogsTabsClient isAdmin={user.role === "ADMIN"} />
      </div>
    );
  } catch {
    redirect("/auth/signin");
  }
}
