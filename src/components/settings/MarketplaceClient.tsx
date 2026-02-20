"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Download, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { useUser } from "@/hooks/useUser";
import AdminPasswordDialog from "@/components/settings/AdminPasswordDialog";
import type { CatalogExtension } from "@/lib/extensions/marketplace/types";
import { compareSemver } from "@/lib/extensions/manifest";

type InstalledInfo = {
  id: string;
  version: string;
  state: "installed" | "enabled" | "disabled" | "error";
};

export default function MarketplaceClient() {
  const { user } = useUser();
  const isAdmin = user?.role === "ADMIN";
  const [catalog, setCatalog] = useState<CatalogExtension[]>([]);
  const [installedMap, setInstalledMap] = useState<
    Record<string, InstalledInfo>
  >({});
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<{
    type: "install" | "update" | "uninstall";
    item: CatalogExtension;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const request = async (path: string, method: string, body?: unknown) => {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || "操作に失敗しました") as Error & {
        status?: number;
      };
      error.status = res.status;
      throw error;
    }
    return data;
  };

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request("/api/marketplace/catalog", "GET");
      setCatalog(data.catalog || []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "カタログ取得に失敗しました",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadInstalled = useCallback(async () => {
    if (!isAdmin) {
      setInstalledMap({});
      return;
    }
    try {
      const data = await request("/api/extensions", "GET");
      const map: Record<string, InstalledInfo> = {};
      for (const ext of data.installed || []) {
        map[ext.id] = {
          id: ext.id,
          version: ext.version,
          state: ext.state,
        };
      }
      setInstalledMap(map);
    } catch {
      setInstalledMap({});
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadInstalled();
  }, [loadInstalled]);

  const handleAction = (
    type: "install" | "update" | "uninstall",
    item: CatalogExtension,
  ) => {
    setAction({ type, item });
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    try {
      const data = await request("/api/admin/verify-password", "POST", {
        password,
      });
      return !!data.valid;
    } catch {
      return false;
    }
  };

  const performAction = async (password: string): Promise<boolean> => {
    if (!action) return false;

    const passwordValid = await verifyPassword(password);
    if (!passwordValid) {
      return false;
    }

    let shouldClose = true;
    setBusy(true);
    try {
      if (action.type === "install") {
        await request("/api/marketplace/install", "POST", {
          extensionId: action.item.id,
          version: action.item.version,
          password,
        });
        showToast(`${action.item.name} をインストールしました`, "success");
      }
      if (action.type === "update") {
        await request("/api/marketplace/update", "POST", {
          extensionId: action.item.id,
          version: action.item.version,
          password,
        });
        showToast(`${action.item.name} を更新しました`, "success");
      }
      if (action.type === "uninstall") {
        await request(
          `/api/marketplace/${encodeURIComponent(action.item.id)}`,
          "DELETE",
          {
            password,
          },
        );
        showToast(`${action.item.name} を削除しました`, "success");
      }
      await loadInstalled();
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        (error as Error & { status?: number }).status === 401
      ) {
        shouldClose = false;
        return false;
      }
      showToast(
        error instanceof Error ? error.message : "操作に失敗しました",
        "error",
      );
      return true;
    } finally {
      setBusy(false);
      if (shouldClose) {
        setAction(null);
      }
    }
  };

  const actionLabel = useMemo(() => {
    if (!action) return "";
    if (action.type === "install") return "拡張機能のインストール";
    if (action.type === "update") return "拡張機能の更新";
    return "拡張機能の削除";
  }, [action]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <Package className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-2 text-sm text-slate-500">カタログを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">掲載中: {catalog.length}件</div>
        <Button size="sm" variant="outline" onClick={loadCatalog}>
          <RefreshCw className="h-4 w-4 mr-1" />
          更新
        </Button>
      </div>

      <div className="space-y-3">
        {catalog.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">拡張が見つかりません</p>
          </div>
        ) : (
          catalog.map((item) => {
            const installed = installedMap[item.id];
            const isInstalled = !!installed;
            const hasUpdate =
              installed && compareSemver(installed.version, item.version) < 0;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {item.name}
                      </h3>
                      <span className="text-xs text-slate-500">
                        v{item.version}
                      </span>
                      {isInstalled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          インストール済み
                        </span>
                      )}
                      {hasUpdate && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          更新あり
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.publisher} · {formatPricing(item)}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex flex-col gap-2">
                      {!isInstalled && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleAction("install", item)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          インストール
                        </Button>
                      )}
                      {isInstalled && hasUpdate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction("update", item)}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          更新
                        </Button>
                      )}
                      {isInstalled && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleAction("uninstall", item)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          削除
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <AdminPasswordDialog
        open={!!action}
        onClose={() => setAction(null)}
        onConfirm={performAction}
        action={actionLabel}
        loading={busy}
      />
    </div>
  );
}

function formatPricing(item: CatalogExtension): string {
  if (item.pricing === "free") return "無料";
  if (item.pricing === "subscription") {
    return item.monthlyPrice
      ? `月額 ¥${item.monthlyPrice.toLocaleString()}`
      : "サブスク";
  }
  return item.price ? `¥${item.price.toLocaleString()}` : "有料";
}
