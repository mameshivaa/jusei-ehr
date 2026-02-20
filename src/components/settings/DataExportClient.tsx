"use client";

import { useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileCode,
  Database,
} from "lucide-react";

type ExportFormat = "json" | "csv" | "xml" | "sql";

export function DataExportClient() {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [options, setOptions] = useState({
    includePatients: true,
    includeVisits: true,
    includeTreatmentRecords: true,
    includeUsers: false,
    includeAuditLogs: false,
    dateRange: {
      enabled: false,
      start: "",
      end: "",
    },
  });
  const [useEncryption, setUseEncryption] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // パスワード検証
      if (useEncryption) {
        if (!password || password.length < 8) {
          setError("パスワードは8文字以上である必要があります");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("パスワードが一致しません");
          setLoading(false);
          return;
        }
      }

      const exportOptions: any = {
        includePatients: options.includePatients,
        includeVisits: options.includeVisits,
        includeTreatmentRecords: options.includeTreatmentRecords,
      };

      if (format === "json") {
        exportOptions.includeUsers = options.includeUsers;
        exportOptions.includeAuditLogs = options.includeAuditLogs;
      }

      if (
        options.dateRange.enabled &&
        options.dateRange.start &&
        options.dateRange.end
      ) {
        exportOptions.dateRange = {
          start: options.dateRange.start,
          end: options.dateRange.end,
        };
      }

      // パスワードを追加
      if (useEncryption && password) {
        exportOptions.password = password;
      }

      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportOptions),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "エクスポートに失敗しました");
      }

      // 暗号化されている場合はZIPファイルとしてダウンロード
      if (useEncryption && password) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export.${format}.encrypted.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccess("暗号化されたZIPファイルのエクスポートが完了しました");
      } else {
        // 暗号化されていない場合は通常の処理
        const data = await response.json();

        // ファイルをダウンロード
        if (format === "csv" && data.files) {
          // CSVは複数ファイル
          for (const file of data.files) {
            const blob = new Blob([file.content], {
              type: "text/csv;charset=utf-8;",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } else if (format === "xml" || format === "sql") {
          // XML/SQLは単一ファイル
          const blob = new Blob([data.content], {
            type: format === "xml" ? "application/xml" : "text/sql",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `export.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          // JSON
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "export.json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        setSuccess("データのエクスポートが完了しました");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "エクスポートに失敗しました",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          データエクスポート
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          ガイドライン「システム設計の見直し（標準化対応）」に準拠し、標準形式または変換が容易な形式でデータをエクスポートします。
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            エクスポート形式
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setFormat("json")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border ${
                format === "json"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <FileJson className="h-4 w-4" />
              JSON
            </button>
            <button
              type="button"
              onClick={() => setFormat("csv")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border ${
                format === "csv"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => setFormat("xml")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border ${
                format === "xml"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <FileCode className="h-4 w-4" />
              XML
            </button>
            <button
              type="button"
              onClick={() => setFormat("sql")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border ${
                format === "sql"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Database className="h-4 w-4" />
              SQL
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            エクスポート対象
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includePatients}
                onChange={(e) =>
                  setOptions({ ...options, includePatients: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm text-slate-700">患者データ</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeVisits}
                onChange={(e) =>
                  setOptions({ ...options, includeVisits: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm text-slate-700">来院記録</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeTreatmentRecords}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    includeTreatmentRecords: e.target.checked,
                  })
                }
                className="rounded"
              />
              <span className="text-sm text-slate-700">施術記録</span>
            </label>
            {format === "json" && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeUsers}
                    onChange={(e) =>
                      setOptions({ ...options, includeUsers: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-slate-700">
                    ユーザーデータ（オプション）
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeAuditLogs}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        includeAuditLogs: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-slate-700">
                    監査ログ（オプション）
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={options.dateRange.enabled}
              onChange={(e) =>
                setOptions({
                  ...options,
                  dateRange: {
                    ...options.dateRange,
                    enabled: e.target.checked,
                  },
                })
              }
              className="rounded"
            />
            <span className="text-sm font-medium text-slate-700">
              日付範囲でフィルタ
            </span>
          </label>
          {options.dateRange.enabled && (
            <div className="flex gap-2 mt-2">
              <input
                type="date"
                value={options.dateRange.start}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    dateRange: { ...options.dateRange, start: e.target.value },
                  })
                }
                className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
              <span className="flex items-center text-slate-600">〜</span>
              <input
                type="date"
                value={options.dateRange.end}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    dateRange: { ...options.dateRange, end: e.target.value },
                  })
                }
                className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-4">
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={useEncryption}
              onChange={(e) => setUseEncryption(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-slate-700">
              パスワード付きZIPで暗号化（推奨）
            </span>
          </label>
          {useEncryption && (
            <div className="space-y-3 ml-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  パスワード <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8文字以上"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  パスワードは8文字以上である必要があります。忘れないように安全な場所に保管してください。
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  パスワード（確認） <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="パスワードを再入力"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {loading ? "エクスポート中..." : "エクスポート"}
          </button>
        </div>
      </div>
    </div>
  );
}
