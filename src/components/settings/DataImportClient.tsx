"use client";

import { useState } from "react";
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  FileCode,
  Database,
  AlertTriangle,
} from "lucide-react";

type ImportFormat = "json" | "csv" | "xml" | "sql";

export function DataImportClient() {
  const [format, setFormat] = useState<ImportFormat>("json");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setSuccess(null);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("ファイルを選択してください");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setImportResult(null);

    try {
      let content: string;
      let endpoint: string;

      if (format === "csv") {
        content = await file.text();
        endpoint = "/api/import/csv";
      } else if (format === "xml") {
        content = await file.text();
        endpoint = "/api/import/xml";
      } else if (format === "json") {
        content = await file.text();
        endpoint = "/api/import/json";
      } else {
        // SQL形式は注意が必要
        setError(
          "SQL形式のインポートはデータベース全体を置き換えるため、手動で実行してください。バックアップを取ってから実行してください。",
        );
        setLoading(false);
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          format === "json"
            ? { data: JSON.parse(content) }
            : format === "csv"
              ? { csvContent: content }
              : { xmlContent: content },
        ),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "インポートに失敗しました");
      }

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        setSuccess(
          `インポートが完了しました。患者: ${result.imported.patients}件、来院記録: ${result.imported.visits}件、施術記録: ${result.imported.treatmentRecords}件`,
        );
      } else {
        setError(
          `インポート中にエラーが発生しました: ${result.errors.join(", ")}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          データインポート
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          ガイドライン「システム設計の見直し（標準化対応）」に準拠し、標準形式または変換が容易な形式でデータをインポートします。
        </p>
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-medium mb-1">注意事項</p>
            <ul className="list-disc list-inside space-y-1">
              <li>インポート前にデータのバックアップを取ることを推奨します</li>
              <li>患者IDが重複する場合はスキップされます</li>
              <li>個人情報は自動的に暗号化されます</li>
            </ul>
          </div>
        </div>
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

      {importResult &&
        importResult.errors &&
        importResult.errors.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
            <p className="font-medium mb-2">エラー詳細:</p>
            <ul className="list-disc list-inside space-y-1">
              {importResult.errors.map((err: string, index: number) => (
                <li key={index}>{err}</li>
              ))}
            </ul>
          </div>
        )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            インポート形式
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
              disabled
              title="SQL形式のインポートは手動で実行してください"
            >
              <Database className="h-4 w-4" />
              SQL
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            ファイル選択
          </label>
          <input
            type="file"
            accept={
              format === "json"
                ? ".json"
                : format === "csv"
                  ? ".csv"
                  : format === "xml"
                    ? ".xml"
                    : ".sql"
            }
            onChange={handleFileSelect}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          {file && (
            <p className="mt-2 text-sm text-slate-600">
              選択されたファイル: {file.name}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleImport}
            disabled={loading || !file || format === "sql"}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            {loading ? "インポート中..." : "インポート"}
          </button>
        </div>
      </div>
    </div>
  );
}
