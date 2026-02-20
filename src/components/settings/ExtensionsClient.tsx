"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Package,
  Power,
  PowerOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileText,
  Download,
  Link,
  Layout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AccessibleModal from "@/components/ui/AccessibleModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import type { ExtensionCapabilities, RiskLevel } from "@/lib/extensions";

// =============================================================================
// 型定義
// =============================================================================

interface InstalledExtension {
  id: string;
  name: string;
  version: string;
  publisher: string;
  description: string | null;
  state: "installed" | "enabled" | "disabled" | "error";
  installedAt: string;
  enabledAt: string | null;
  path: string;
  requestedCapabilities: ExtensionCapabilities;
  grantedCapabilities: ExtensionCapabilities;
  ungrantedCapabilities: ExtensionCapabilities;
  capabilitiesDisplay: string[];
  grantedCapabilitiesDisplay: string[];
  riskAssessment: {
    overall: RiskLevel;
    details: Array<{
      capability: string;
      risk: RiskLevel;
      reason: string;
    }>;
  };
  contributions: {
    commands: number;
    templates: number;
    exporters: number;
    integrations: number;
    views: number;
  };
}

interface DiscoveredExtension {
  path: string;
  valid: boolean;
  manifest: {
    id: string;
    name: string;
    version: string;
    publisher: string;
    description: string | null;
  } | null;
  errors: string[] | null;
}

interface Props {
  initialInstalled: InstalledExtension[];
  initialDiscovered: DiscoveredExtension[];
}

// =============================================================================
// コンポーネント
// =============================================================================

export default function ExtensionsClient({
  initialInstalled,
  initialDiscovered,
}: Props) {
  const [installed, setInstalled] = useState(initialInstalled);
  const [discovered] = useState(initialDiscovered);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    extensionId: string;
    action: "enable" | "disable" | "grant" | "revoke";
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printEntityType, setPrintEntityType] = useState<
    "patient" | "chart" | "visit" | "treatmentRecord"
  >("patient");
  const [printEntityId, setPrintEntityId] = useState("");
  const [printEntityName, setPrintEntityName] = useState("");
  const { showToast } = useToast();

  // 拡張の状態を更新
  const updateExtension = (id: string, patch: Partial<InstalledExtension>) => {
    setInstalled((prev) =>
      prev.map((ext) => (ext.id === id ? { ...ext, ...patch } : ext)),
    );
  };

  // API呼び出し
  const request = async (path: string, method: string, body?: unknown) => {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "操作に失敗しました");
    return data;
  };

  // 有効化
  const handleEnable = async (ext: InstalledExtension) => {
    // 権限が付与されていない場合は先に付与
    if (Object.keys(ext.grantedCapabilities).length === 0) {
      setConfirmAction({
        extensionId: ext.id,
        action: "grant",
        name: ext.name,
      });
    } else {
      setConfirmAction({
        extensionId: ext.id,
        action: "enable",
        name: ext.name,
      });
    }
  };

  // 無効化
  const handleDisable = (ext: InstalledExtension) => {
    setConfirmAction({
      extensionId: ext.id,
      action: "disable",
      name: ext.name,
    });
  };

  // 権限付与
  const handleGrant = (ext: InstalledExtension) => {
    setConfirmAction({ extensionId: ext.id, action: "grant", name: ext.name });
  };

  // 権限剥奪
  const handleRevoke = (ext: InstalledExtension) => {
    setConfirmAction({ extensionId: ext.id, action: "revoke", name: ext.name });
  };

  // 確認後の実行
  const onConfirm = async () => {
    if (!confirmAction) return;
    const { extensionId, action } = confirmAction;
    const ext = installed.find((e) => e.id === extensionId);
    if (!ext) return;

    setBusy(true);
    try {
      const encodedId = encodeURIComponent(extensionId);

      switch (action) {
        case "enable": {
          await request(`/api/extensions/${encodedId}/enable`, "POST");
          updateExtension(extensionId, {
            state: "enabled",
            enabledAt: new Date().toISOString(),
          });
          showToast(`${ext.name} を有効化しました`, "success");
          break;
        }
        case "disable": {
          await request(`/api/extensions/${encodedId}/disable`, "POST");
          updateExtension(extensionId, {
            state: "disabled",
            enabledAt: null,
          });
          showToast(`${ext.name} を無効化しました`, "success");
          break;
        }
        case "grant": {
          // 要求された権限をすべて付与
          await request(`/api/extensions/${encodedId}/capabilities`, "POST", {
            capabilities: ext.requestedCapabilities,
          });
          updateExtension(extensionId, {
            grantedCapabilities: ext.requestedCapabilities,
            ungrantedCapabilities: {},
            grantedCapabilitiesDisplay: ext.capabilitiesDisplay,
          });
          showToast(`${ext.name} に権限を付与しました`, "success");
          break;
        }
        case "revoke": {
          await request(`/api/extensions/${encodedId}/capabilities`, "DELETE");
          updateExtension(extensionId, {
            state: "installed",
            enabledAt: null,
            grantedCapabilities: {},
            ungrantedCapabilities: ext.requestedCapabilities,
            grantedCapabilitiesDisplay: [],
          });
          showToast(`${ext.name} の権限を剥奪しました`, "success");
          break;
        }
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "操作に失敗しました", "error");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  // 再読み込み
  const handleReload = async () => {
    setReloading(true);
    try {
      const data = await request("/api/extensions", "POST");
      showToast(
        `${data.loaded?.length || 0}件の拡張をロードしました`,
        "success",
      );
      // ページリロードで最新状態を取得
      window.location.reload();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "再読み込みに失敗しました",
        "error",
      );
    } finally {
      setReloading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleOpenPrint = () => {
    setPrintEntityId("");
    setPrintEntityName("");
    setPrintModalOpen(true);
  };

  const handleStartPrint = () => {
    if (!printEntityId.trim()) {
      showToast("エンティティIDを入力してください", "error");
      return;
    }
    const opener = (window as any).__openTemplatePrintDialog as
      | undefined
      | ((
          entityType: "patient" | "chart" | "visit" | "treatmentRecord",
          entityId: string,
          entityName?: string,
        ) => void);
    if (!opener) {
      showToast("印刷ダイアログが初期化されていません", "error");
      return;
    }
    opener(
      printEntityType,
      printEntityId.trim(),
      printEntityName.trim() || undefined,
    );
    setPrintModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          インストール済み: {installed.length}件
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleOpenPrint}>
            <FileText className="h-4 w-4 mr-1" />
            テンプレート印刷
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReload}
            disabled={reloading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${reloading ? "animate-spin" : ""}`}
            />
            再読み込み
          </Button>
        </div>
      </div>

      <AccessibleModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title="テンプレート印刷"
        description="対象エンティティを指定して印刷テンプレートを選択します"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              対象エンティティ
            </label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={printEntityType}
              onChange={(e) =>
                setPrintEntityType(
                  e.target.value as
                    | "patient"
                    | "chart"
                    | "visit"
                    | "treatmentRecord",
                )
              }
            >
              <option value="patient">患者</option>
              <option value="chart">カルテ</option>
              <option value="visit">来院</option>
              <option value="treatmentRecord">施術記録</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              エンティティID
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="例: patient-id"
              value={printEntityId}
              onChange={(e) => setPrintEntityId(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              表示名（任意）
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="例: 山田 太郎"
              value={printEntityName}
              onChange={(e) => setPrintEntityName(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPrintModalOpen(false)}>
              キャンセル
            </Button>
            <Button variant="primary" onClick={handleStartPrint}>
              テンプレートを選択
            </Button>
          </div>
        </div>
      </AccessibleModal>

      {/* インストール済み拡張 */}
      <div className="space-y-3">
        {installed.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              インストールされている拡張はありません
            </p>
            <p className="mt-1 text-xs text-slate-400">
              extensions/ フォルダに拡張を配置し、再読み込みしてください
            </p>
          </div>
        ) : (
          installed.map((ext) => (
            <ExtensionCard
              key={ext.id}
              extension={ext}
              expanded={expandedId === ext.id}
              onToggleExpand={() => toggleExpand(ext.id)}
              onEnable={() => handleEnable(ext)}
              onDisable={() => handleDisable(ext)}
              onGrant={() => handleGrant(ext)}
              onRevoke={() => handleRevoke(ext)}
            />
          ))
        )}
      </div>

      {/* 無効なマニフェスト（エラー表示） */}
      {discovered.filter((d) => !d.valid).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-700 mb-2">
            読み込みエラー
          </h3>
          <div className="space-y-2">
            {discovered
              .filter((d) => !d.valid)
              .map((d, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-red-200 bg-red-50 p-3"
                >
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-red-800">
                        {d.path.split("/").pop()}
                      </div>
                      <div className="text-xs text-red-600 mt-1">
                        {d.errors?.join(", ")}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 確認モーダル */}
      <ConfirmModal
        open={!!confirmAction}
        title={getConfirmTitle(confirmAction?.action)}
        description={getConfirmDescription(confirmAction)}
        confirmLabel={getConfirmLabel(confirmAction?.action)}
        onConfirm={onConfirm}
        onCancel={() => setConfirmAction(null)}
        busy={busy}
      />
    </div>
  );
}

// =============================================================================
// サブコンポーネント
// =============================================================================

function ExtensionCard({
  extension: ext,
  expanded,
  onToggleExpand,
  onEnable,
  onDisable,
  onGrant,
  onRevoke,
}: {
  extension: InstalledExtension;
  expanded: boolean;
  onToggleExpand: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onGrant: () => void;
  onRevoke: () => void;
}) {
  const isEnabled = ext.state === "enabled";
  const hasPermissions = Object.keys(ext.grantedCapabilities).length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* メインヘッダー */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50"
        onClick={onToggleExpand}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{ext.name}</span>
            <span className="text-xs text-slate-500">v{ext.version}</span>
            <StateBadge state={ext.state} />
            <RiskBadge risk={ext.riskAssessment.overall} />
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {ext.publisher} · {ext.description || "説明なし"}
          </div>
        </div>

        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {isEnabled ? (
            <Button size="sm" variant="outline" onClick={onDisable}>
              <PowerOff className="h-4 w-4 mr-1" />
              無効化
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={onEnable}
              disabled={!hasPermissions && ext.state !== "installed"}
            >
              <Power className="h-4 w-4 mr-1" />
              {hasPermissions ? "有効化" : "権限付与して有効化"}
            </Button>
          )}
        </div>
      </div>

      {/* 展開時の詳細 */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
          {/* 寄与点サマリー */}
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">
              寄与点
            </div>
            <div className="flex flex-wrap gap-2">
              {ext.contributions.commands > 0 && (
                <ContributionBadge
                  icon={Terminal}
                  label="コマンド"
                  count={ext.contributions.commands}
                />
              )}
              {ext.contributions.templates > 0 && (
                <ContributionBadge
                  icon={FileText}
                  label="テンプレート"
                  count={ext.contributions.templates}
                />
              )}
              {ext.contributions.exporters > 0 && (
                <ContributionBadge
                  icon={Download}
                  label="エクスポーター"
                  count={ext.contributions.exporters}
                />
              )}
              {ext.contributions.integrations > 0 && (
                <ContributionBadge
                  icon={Link}
                  label="連携"
                  count={ext.contributions.integrations}
                />
              )}
              {ext.contributions.views > 0 && (
                <ContributionBadge
                  icon={Layout}
                  label="ビュー"
                  count={ext.contributions.views}
                />
              )}
            </div>
          </div>

          {/* 権限 */}
          <div>
            <div className="text-xs font-medium text-slate-600 mb-2">
              要求された権限
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ext.capabilitiesDisplay.map((cap, i) => (
                <span
                  key={i}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    ext.grantedCapabilitiesDisplay.includes(cap)
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {/* リスク詳細 */}
          {ext.riskAssessment.details.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-600 mb-2">
                リスク評価
              </div>
              <div className="space-y-1">
                {ext.riskAssessment.details.map((detail, i) => (
                  <div
                    key={i}
                    className={`text-xs px-2 py-1 rounded ${
                      detail.risk === "high"
                        ? "bg-red-50 text-red-700"
                        : detail.risk === "medium"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span className="font-medium">{detail.capability}</span>:{" "}
                    {detail.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* メタ情報 */}
          <div className="text-xs text-slate-500 space-y-1">
            <div>
              インストール:{" "}
              {format(new Date(ext.installedAt), "yyyy/MM/dd HH:mm")}
            </div>
            {ext.enabledAt && (
              <div>
                有効化: {format(new Date(ext.enabledAt), "yyyy/MM/dd HH:mm")}
              </div>
            )}
            <div className="truncate">パス: {ext.path}</div>
          </div>

          {/* 操作ボタン */}
          <div className="flex gap-2 pt-2">
            {hasPermissions ? (
              <Button size="sm" variant="outline" onClick={onRevoke}>
                <ShieldAlert className="h-4 w-4 mr-1" />
                権限を剥奪
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onGrant}>
                <ShieldCheck className="h-4 w-4 mr-1" />
                権限を付与
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: InstalledExtension["state"] }) {
  switch (state) {
    case "enabled":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3" />
          有効
        </span>
      );
    case "disabled":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
          <PowerOff className="h-3 w-3" />
          無効
        </span>
      );
    case "installed":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
          <Package className="h-3 w-3" />
          未設定
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
          <XCircle className="h-3 w-3" />
          エラー
        </span>
      );
  }
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  switch (risk) {
    case "high":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="h-3 w-3" />
          高リスク
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
          <Shield className="h-3 w-3" />
          中リスク
        </span>
      );
    case "low":
      return null; // 低リスクは表示しない
  }
}

function ContributionBadge({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
      <Icon className="h-3 w-3" />
      {label}: {count}
    </span>
  );
}

// =============================================================================
// ヘルパー
// =============================================================================

function getConfirmTitle(action?: string): string {
  switch (action) {
    case "enable":
      return "拡張を有効化";
    case "disable":
      return "拡張を無効化";
    case "grant":
      return "権限を付与";
    case "revoke":
      return "権限を剥奪";
    default:
      return "";
  }
}

function getConfirmDescription(
  confirmAction: { action: string; name: string } | null,
): string {
  if (!confirmAction) return "";
  const { action, name } = confirmAction;
  switch (action) {
    case "enable":
      return `"${name}" を有効化しますか？`;
    case "disable":
      return `"${name}" を無効化しますか？この拡張の機能は使用できなくなります。`;
    case "grant":
      return `"${name}" に要求されたすべての権限を付与しますか？`;
    case "revoke":
      return `"${name}" の権限を剥奪しますか？拡張は無効化されます。`;
    default:
      return "";
  }
}

function getConfirmLabel(action?: string): string {
  switch (action) {
    case "enable":
      return "有効化する";
    case "disable":
      return "無効化する";
    case "grant":
      return "付与する";
    case "revoke":
      return "剥奪する";
    default:
      return "実行";
  }
}
