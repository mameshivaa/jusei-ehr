"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar, Download } from "lucide-react";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  resourcePath: string | null;
  severity: string;
  category: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  metadata: any;
};

export function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    entityType: "",
    action: "",
    startDate: "",
    endDate: "",
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.action && { action: filters.action }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch logs");

      const data = await response.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [
    filters.action,
    filters.endDate,
    filters.entityType,
    filters.startDate,
    page,
  ]);

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    params.set("format", "csv");
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.action) params.set("action", filters.action);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    window.location.href = `/api/audit-logs/export?${params.toString()}`;
  }, [filters.action, filters.endDate, filters.entityType, filters.startDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      CREATE: "作成",
      READ: "閲覧",
      UPDATE: "更新",
      DELETE: "削除",
      CONFIRM: "確定",
      LOGIN: "ログイン",
      LOGOUT: "ログアウト",
      EXPORT: "エクスポート",
      VERIFY: "検証",
      SYSTEM_ERROR: "システムエラー",
      SYSTEM_WARNING: "システム警告",
      CLIENT_ERROR: "クライアントエラー",
      CLIENT_WARNING: "クライアント警告",
      CLIENT_CLICK: "クリック",
      CLIENT_VIEW: "ページ閲覧",
      UNHANDLED_REJECTION: "未処理Promise",
      UNCAUGHT_EXCEPTION: "未捕捉例外",
      PROCESS_WARNING: "プロセス警告",
    };
    return labels[action] || action;
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      PATIENT: "患者",
      CHART: "カルテ",
      TREATMENT_RECORD: "施術記録",
      VISIT: "来院記録",
      USER: "ユーザー",
      SYSTEM: "システム",
    };
    return labels[type] || type;
  };

  const formatDateInputLabel = (value: string) => {
    if (!value) return "指定なし";
    try {
      return format(new Date(value), "yyyy/MM/dd (EEE)", { locale: ja });
    } catch {
      return value;
    }
  };

  // 1つのピルで「対象」か「操作」のどちらか一方を選択（カルテ操作ログと同じ1本のタブ）
  const filterOptions: {
    value: string;
    kind: "all" | "entity" | "action";
    label: string;
  }[] = [
    { value: "", kind: "all", label: "すべて" },
    { value: "PATIENT", kind: "entity", label: "患者" },
    { value: "CHART", kind: "entity", label: "カルテ" },
    { value: "TREATMENT_RECORD", kind: "entity", label: "施術記録" },
    { value: "VISIT", kind: "entity", label: "来院記録" },
    { value: "USER", kind: "entity", label: "ユーザー" },
    { value: "SYSTEM", kind: "entity", label: "システム" },
    { value: "CREATE", kind: "action", label: "作成" },
    { value: "UPDATE", kind: "action", label: "更新" },
    { value: "DELETE", kind: "action", label: "削除" },
    { value: "CONFIRM", kind: "action", label: "確定" },
    { value: "LOGIN", kind: "action", label: "ログイン" },
    { value: "SYSTEM_ERROR", kind: "action", label: "システムエラー" },
    { value: "CLIENT_ERROR", kind: "action", label: "クライアントエラー" },
    { value: "CLIENT_CLICK", kind: "action", label: "クリック" },
    { value: "CLIENT_VIEW", kind: "action", label: "ページ閲覧" },
  ];

  const selectedFilterLabel = useMemo(() => {
    if (filters.entityType) return getEntityTypeLabel(filters.entityType);
    if (filters.action) return getActionLabel(filters.action);
    return "すべて";
  }, [filters.entityType, filters.action]);

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      INFO: "bg-slate-100 text-slate-800",
      WARNING: "bg-yellow-100 text-yellow-800",
      ERROR: "bg-red-100 text-red-800",
      CRITICAL: "bg-red-200 text-red-900",
    };
    return colors[severity] || "bg-slate-100 text-slate-800";
  };

  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, string> = {
      INFO: "情報",
      WARNING: "注意",
      ERROR: "エラー",
      CRITICAL: "重大",
    };
    return labels[severity] || severity;
  };

  return (
    <div className="space-y-4">
      {/* ツールバー：フィルター（左）・CSV出力（右） → その下に期間＋表示・表示件数 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div
            className="inline-flex flex-nowrap items-center gap-1 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200 overflow-x-auto min-w-0"
            role="group"
            aria-label="監査ログフィルター"
          >
            {filterOptions.map((opt) => {
              const selected =
                (opt.kind === "all" &&
                  !filters.entityType &&
                  !filters.action) ||
                (opt.kind === "entity" && filters.entityType === opt.value) ||
                (opt.kind === "action" && filters.action === opt.value);
              return (
                <button
                  key={opt.value || "all"}
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      entityType: opt.kind === "entity" ? opt.value : "",
                      action: opt.kind === "action" ? opt.value : "",
                    }));
                    setPage(1);
                  }}
                  className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-full transition ${
                    selected
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                  aria-pressed={selected}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV出力
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              期間
            </span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, startDate: e.target.value }));
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
              aria-label="開始日"
            />
            <span className="text-slate-400">〜</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, endDate: e.target.value }));
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
              aria-label="終了日"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>
              表示:{" "}
              <span className="font-medium text-slate-900">
                {selectedFilterLabel}
              </span>
            </span>
            <span>
              表示件数:{" "}
              <span className="font-medium text-slate-900">
                {loading ? "…" : `${logs.length}件`}
              </span>
            </span>
            {(filters.startDate || filters.endDate) && (
              <span>
                期間: {formatDateInputLabel(filters.startDate)} 〜{" "}
                {formatDateInputLabel(filters.endDate)}
              </span>
            )}
            {totalPages > 1 && (
              <span>
                ページ: {page}/{totalPages}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ログ一覧：枠を薄く */}
      <div className="rounded-lg border border-slate-100 bg-white overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            読み込み中...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            ログがありません
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      日時
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      ユーザー
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      操作
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      対象
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      重要度
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-sm text-slate-800">
                        {format(
                          new Date(log.createdAt),
                          "yyyy/MM/dd HH:mm:ss",
                          {
                            locale: ja,
                          },
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-800">
                        {log.user
                          ? `${log.user.name} (${log.user.email})`
                          : "システム"}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-800">
                        {getActionLabel(log.action)}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-800">
                        {getEntityTypeLabel(log.entityType)}
                        {log.entityId && ` (${log.entityId.slice(0, 8)}...)`}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}
                          title={log.severity}
                        >
                          {getSeverityLabel(log.severity)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-sm rounded-md border border-slate-100 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  前へ
                </button>
                <span className="text-sm text-slate-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-sm rounded-md border border-slate-100 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
