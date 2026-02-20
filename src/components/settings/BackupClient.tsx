"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Shield,
  FileText,
} from "lucide-react";

type Backup = {
  fileName: string;
  filePath: string;
  metadataPath: string;
  createdAt: string;
  description: string;
  fileSize: number;
  encrypted: boolean;
};

export function BackupClient() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [encrypted, setEncrypted] = useState(false);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/backup");
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      } else {
        console.error("Failed to fetch backups");
      }
    } catch (error) {
      console.error("Error fetching backups:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setProcessing("create");
    try {
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          encrypted,
        }),
      });
      if (response.ok) {
        await fetchBackups();
        setDescription("");
        setEncrypted(false);
        alert("バックアップを作成しました");
      } else {
        const error = await response.json();
        alert(error.error || "バックアップの作成に失敗しました");
      }
    } catch (error) {
      alert("バックアップの作成に失敗しました");
    } finally {
      setProcessing(null);
    }
  };

  const handleRestore = async (backup: Backup) => {
    const createdAtLabel = format(
      new Date(backup.createdAt),
      "yyyy年MM月dd日 HH:mm:ss",
      { locale: ja },
    );
    const descriptionLabel = backup.description
      ? `\n説明: ${backup.description}`
      : "";
    const message = [
      "バックアップを復元しますか？",
      `対象: ${createdAtLabel}${descriptionLabel}`,
      "復元すると、この日時以降の変更は失われます。",
      "復元前に暗号化バックアップを自動作成します。",
      "復元後はアプリを再起動します。",
    ].join("\n");
    if (!confirm(message)) {
      return;
    }

    setProcessing(`restore-${backup.fileName}`);
    try {
      const response = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: backup.fileName }),
      });
      if (response.ok) {
        if (typeof window !== "undefined" && window.electronAPI?.restartApp) {
          window.electronAPI.restartApp();
          return;
        }
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || "バックアップの復元に失敗しました");
      }
    } catch (error) {
      alert("バックアップの復元に失敗しました");
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm("このバックアップを削除しますか？")) {
      return;
    }

    setProcessing(`delete-${fileName}`);
    try {
      const response = await fetch(
        `/api/backup?fileName=${encodeURIComponent(fileName)}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        await fetchBackups();
        alert("バックアップを削除しました");
      } else {
        const error = await response.json();
        alert(error.error || "バックアップの削除に失敗しました");
      }
    } catch (error) {
      alert("バックアップの削除に失敗しました");
    } finally {
      setProcessing(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">バックアップ管理</h2>
        <button
          onClick={fetchBackups}
          className="flex items-center gap-2 px-3 py-1 text-sm text-slate-700 hover:text-slate-900"
        >
          <RefreshCw className="h-4 w-4" />
          更新
        </button>
      </div>

      {/* バックアップ作成フォーム */}
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          新しいバックアップを作成
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              説明（オプション）
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 重要操作前のバックアップ"
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="encrypted"
                checked={encrypted}
                onChange={(e) => setEncrypted(e.target.checked)}
                className="h-4 w-4"
              />
              <label
                htmlFor="encrypted"
                className="text-sm text-slate-700 flex items-center gap-1"
              >
                <Shield className="h-4 w-4" />
                BACKUP_SECRETで暗号化（推奨）
              </label>
            </div>
            {encrypted && (
              <p className="ml-6 text-xs text-slate-500">
                暗号化にはシステム設定のBACKUP_SECRETを使用します。
              </p>
            )}
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={processing === "create"}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {processing === "create" ? "作成中..." : "バックアップを作成"}
          </button>
        </div>
      </div>

      {/* バックアップ一覧 */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          バックアップ一覧
        </h3>
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900 mb-1">復元の注意点</p>
          <ul className="list-disc list-inside space-y-1">
            <li>復元すると、その日時以降の変更は失われます。</li>
            <li>復元前に暗号化バックアップを自動作成します。</li>
            <li>復元後はアプリを再起動します。</li>
            <li>暗号化バックアップには BACKUP_SECRET が必要です。</li>
          </ul>
        </div>
        {backups.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            バックアップがありません
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div
                key={backup.fileName}
                className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-slate-600" />
                      <span className="font-semibold text-slate-900">
                        {backup.fileName}
                      </span>
                      {backup.encrypted && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-800">
                          <Shield className="h-3 w-3" />
                          暗号化済み
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>
                        作成日時:{" "}
                        {format(
                          new Date(backup.createdAt),
                          "yyyy年MM月dd日 HH:mm:ss",
                          { locale: ja },
                        )}
                      </p>
                      {backup.description && <p>説明: {backup.description}</p>}
                      <p>サイズ: {formatFileSize(backup.fileSize)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestore(backup)}
                      disabled={processing === `restore-${backup.fileName}`}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {processing === `restore-${backup.fileName}`
                        ? "復元中..."
                        : "復元"}
                    </button>
                    <button
                      onClick={() => handleDelete(backup.fileName)}
                      disabled={processing === `delete-${backup.fileName}`}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {processing === `delete-${backup.fileName}`
                        ? "削除中..."
                        : "削除"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
