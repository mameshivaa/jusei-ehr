"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";

type ProxyOperation = {
  id: string;
  operatorId: string;
  approverId: string;
  entityType: string;
  entityId: string;
  action: string;
  reason: string;
  status: string;
  approvedAt: string | null;
  createdAt: string;
  operator: {
    id: string;
    name: string;
    email: string;
  };
  approver: {
    id: string;
    name: string;
    email: string;
  };
};

export function ProxyOperationsClient() {
  const [operations, setOperations] = useState<ProxyOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchOperations = async () => {
    setLoading(true);
    try {
      const url = statusFilter
        ? `/api/proxy-operations?status=${statusFilter}`
        : "/api/proxy-operations";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setOperations(data);
      } else {
        console.error("Failed to fetch proxy operations");
      }
    } catch (error) {
      console.error("Error fetching proxy operations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const response = await fetch(`/api/proxy-operations/${id}/approve`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchOperations();
      } else {
        const error = await response.json();
        alert(error.error || "承認に失敗しました");
      }
    } catch (error) {
      alert("承認に失敗しました");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      const response = await fetch(`/api/proxy-operations/${id}/reject`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchOperations();
      } else {
        const error = await response.json();
        alert(error.error || "却下に失敗しました");
      }
    } catch (error) {
      alert("却下に失敗しました");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" />
            承認待ち
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3" />
            承認済み
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">
            <XCircle className="h-3 w-3" />
            却下済み
          </span>
        );
      default:
        return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "CREATE":
        return "作成";
      case "UPDATE":
        return "更新";
      case "DELETE":
        return "削除";
      default:
        return action;
    }
  };

  const getEntityTypeLabel = (entityType: string) => {
    switch (entityType) {
      case "PATIENT":
        return "患者";
      case "TREATMENT_RECORD":
        return "施術記録";
      default:
        return entityType;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">代行操作の承認</h2>
        <button
          onClick={fetchOperations}
          className="flex items-center gap-2 px-3 py-1 text-sm text-slate-700 hover:text-slate-900"
        >
          <RefreshCw className="h-4 w-4" />
          更新
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter("PENDING")}
          className={`px-3 py-1 text-sm rounded ${
            statusFilter === "PENDING"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          承認待ち
        </button>
        <button
          onClick={() => setStatusFilter("APPROVED")}
          className={`px-3 py-1 text-sm rounded ${
            statusFilter === "APPROVED"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          承認済み
        </button>
        <button
          onClick={() => setStatusFilter("REJECTED")}
          className={`px-3 py-1 text-sm rounded ${
            statusFilter === "REJECTED"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          却下済み
        </button>
        <button
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1 text-sm rounded ${
            statusFilter === ""
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          全て
        </button>
      </div>

      {operations.length === 0 ? (
        <div className="text-center py-12 text-slate-600">
          {statusFilter
            ? "該当する代行操作がありません"
            : "代行操作がありません"}
        </div>
      ) : (
        <div className="space-y-4">
          {operations.map((operation) => (
            <div
              key={operation.id}
              className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(operation.status)}
                    <span className="text-sm text-slate-600">
                      {getEntityTypeLabel(operation.entityType)}の
                      {getActionLabel(operation.action)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 space-y-1">
                    <p>
                      <span className="font-semibold">操作者:</span>{" "}
                      {operation.operator.name} ({operation.operator.email})
                    </p>
                    <p>
                      <span className="font-semibold">承認者:</span>{" "}
                      {operation.approver.name} ({operation.approver.email})
                    </p>
                    <p>
                      <span className="font-semibold">代行理由:</span>{" "}
                      {operation.reason}
                    </p>
                    <p className="text-slate-600">
                      作成日時:{" "}
                      {format(
                        new Date(operation.createdAt),
                        "yyyy年MM月dd日 HH:mm",
                        { locale: ja },
                      )}
                    </p>
                    {operation.approvedAt && (
                      <p className="text-slate-600">
                        {operation.status === "APPROVED" ? "承認" : "却下"}日時:{" "}
                        {format(
                          new Date(operation.approvedAt),
                          "yyyy年MM月dd日 HH:mm",
                          {
                            locale: ja,
                          },
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {operation.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(operation.id)}
                      disabled={processing === operation.id}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {processing === operation.id ? "処理中..." : "承認"}
                    </button>
                    <button
                      onClick={() => handleReject(operation.id)}
                      disabled={processing === operation.id}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {processing === operation.id ? "処理中..." : "却下"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
