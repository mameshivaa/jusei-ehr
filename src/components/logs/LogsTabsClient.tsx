"use client";

import { useState } from "react";
import { ChartLogsClient } from "@/components/logs/ChartLogsClient";
import { AuditLogsClient } from "@/components/settings/AuditLogsClient";

type TabId = "chart" | "audit";

export function LogsTabsClient({ isAdmin }: { isAdmin: boolean }) {
  const [activeTab, setActiveTab] = useState<TabId>("chart");

  const tabs: { id: TabId; label: string }[] = [
    { id: "chart", label: "カルテ操作ログ" },
    { id: "audit", label: "監査ログ" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
              {tab.id === "audit" && !isAdmin ? (
                <span className="text-[10px] text-slate-400">管理者のみ</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {activeTab === "chart" && <ChartLogsClient isAdmin={isAdmin} />}
        {activeTab === "audit" &&
          (isAdmin ? (
            <AuditLogsClient />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              監査ログは管理者のみ閲覧できます。
            </div>
          ))}
      </div>
    </div>
  );
}
