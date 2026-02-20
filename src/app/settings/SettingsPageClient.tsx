"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Users, Database, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListPanel, ListHeader } from "@/components/ui/ListPanel";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import AccessibleModal from "@/components/ui/AccessibleModal";
import PageHeader from "@/components/layout/PageHeader";
import { usePathname, useSearchParams } from "next/navigation";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SECURITY_ADMIN" | "PRACTITIONER" | "RECEPTION";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  mfaEnabled: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  updatedAt: string;
};

type Backup = {
  fileName: string;
  filePath: string;
  metadataPath: string;
  createdAt: string;
  description: string;
  fileSize: number;
  encrypted: boolean;
};

type BackupLocationStatus = {
  preferredSource: "external" | "default" | "custom";
  activeSource: "external" | "default" | "custom";
  directory: string;
  externalAvailable: boolean;
  customAvailable: boolean;
  fallbackUsed: boolean;
};

type BackupMissingStatus = {
  required: boolean;
  isMissing: boolean;
  missingSince: string | null;
  daysMissing: number;
  alertAfterDays: number;
};

type TabId = "account" | "backup";

const roleLabel: Record<UserRow["role"], string> = {
  ADMIN: "管理者",
  SECURITY_ADMIN: "セキュリティ管理者",
  PRACTITIONER: "柔整師",
  RECEPTION: "受付",
};

const statusLabel: Record<UserRow["status"], string> = {
  ACTIVE: "有効",
  SUSPENDED: "停止",
  DELETED: "削除",
};

export default function SettingsPageClient({
  initialUsers,
  initialTab,
}: {
  initialUsers: UserRow[];
  initialTab: TabId;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "account", label: "アカウント", icon: <Users className="h-4 w-4" /> },
    {
      id: "backup",
      label: "バックアップ",
      icon: <Database className="h-4 w-4" />,
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <PageHeader title="設定" subtitle="アカウント・バックアップ" />

      {/* タブナビゲーション */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              const params = new URLSearchParams(searchParams?.toString());
              params.set("tab", tab.id);
              const basePath = pathname || "/settings";
              window.history.replaceState(
                null,
                "",
                `${basePath}?${params.toString()}`,
              );
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="space-y-4">
        {activeTab === "account" && <AccountTab initialUsers={initialUsers} />}
        {activeTab === "backup" && <BackupTab />}
      </div>
    </div>
  );
}

/* ===== アカウントタブ ===== */
function AccountTab({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [confirm, setConfirm] = useState<{
    userId: string;
    kind: "role" | "status" | "delete";
    value: string;
  } | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryMfaCode, setRecoveryMfaCode] = useState("");
  const [recoveryCodeValue, setRecoveryCodeValue] = useState("");
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    loginId: "",
    password: "",
    role: "RECEPTION" as UserRow["role"],
  });
  const { showToast } = useToast();
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const adminLocked = adminCount >= 1;

  const updateUserLocal = (id: string, patch: Partial<UserRow>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const request = async (path: string, method: string, body: unknown) => {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error((data as { error?: string }).error || "エラー");
    return data;
  };

  const handleRoleChange = (user: UserRow, role: UserRow["role"]) => {
    if (role === "ADMIN" && adminLocked && user.role !== "ADMIN") {
      showToast("管理者は1人のみ設定できます", "error");
      return;
    }
    setConfirm({ userId: user.id, kind: "role", value: role });
  };

  const handleStatusChange = (user: UserRow, status: UserRow["status"]) => {
    setConfirm({ userId: user.id, kind: "status", value: status });
  };

  const handleDelete = (user: UserRow) => {
    setConfirm({ userId: user.id, kind: "delete", value: user.name });
  };

  const handleUnlock = async (user: UserRow) => {
    try {
      await request(`/api/admin/users/${user.id}/unlock`, "POST", {
        reason: "manual unlock",
      });
      updateUserLocal(user.id, { failedLoginCount: 0, lockedUntil: null });
      showToast("ロック解除", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "失敗", "error");
    }
  };

  const onConfirm = async () => {
    if (!confirm) return;
    const { userId, kind, value } = confirm;
    try {
      if (kind === "role") {
        await request(`/api/admin/users/${userId}/role`, "PUT", {
          role: value,
        });
        updateUserLocal(userId, { role: value as UserRow["role"] });
        showToast("ロール変更", "success");
      } else if (kind === "status") {
        await request(`/api/admin/users/${userId}/status`, "PUT", {
          status: value,
        });
        updateUserLocal(userId, { status: value as UserRow["status"] });
        showToast("ステータス変更", "success");
      } else if (kind === "delete") {
        await request(`/api/admin/users/${userId}`, "DELETE", {});
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        showToast("アカウント削除", "success");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "更新失敗", "error");
    } finally {
      setConfirm(null);
    }
  };

  const handlePasswordReset = (user: UserRow) => {
    setResetUser(user);
    setNewPassword("");
  };

  const openRecoveryModal = () => {
    setRecoveryOpen(true);
    setRecoveryMfaCode("");
    setRecoveryCodeValue("");
    setRecoveryConfirmed(false);
    setRecoveryError(null);
  };

  const submitRecoveryRegenerate = async () => {
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const data = await request(
        "/api/admin/recovery-code/regenerate",
        "POST",
        { mfaCode: recoveryMfaCode },
      );
      const code = (data as { recoveryCode?: string }).recoveryCode || "";
      setRecoveryCodeValue(code);
      showToast("復旧コードを再発行しました", "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : "再発行に失敗しました";
      setRecoveryError(message);
      showToast(message, "error");
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleCopyRecoveryCode = async () => {
    if (!recoveryCodeValue) return;
    try {
      await navigator.clipboard.writeText(recoveryCodeValue);
      showToast("復旧コードをコピーしました", "success");
    } catch (copyError) {
      console.error("Failed to copy recovery code:", copyError);
      showToast("コピーに失敗しました", "error");
    }
  };

  const submitPasswordReset = async () => {
    if (!resetUser || !newPassword) return;
    setBusy(true);
    try {
      await request(`/api/admin/users/${resetUser.id}/password`, "PUT", {
        password: newPassword,
      });
      showToast("パスワード更新", "success");
      setResetUser(null);
      setNewPassword("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "失敗", "error");
    } finally {
      setBusy(false);
    }
  };

  const submitAddUser = async () => {
    if (!newUser.name || !newUser.loginId || !newUser.password) return;
    if (newUser.loginId.length < 4) {
      showToast("ログインIDは4文字以上", "error");
      return;
    }
    setBusy(true);
    try {
      const created = await request("/api/admin/users", "POST", {
        name: newUser.name,
        email: newUser.loginId,
        password: newUser.password,
        role: newUser.role,
      });
      setUsers((prev) => [...prev, created]);
      setAddOpen(false);
      setNewUser({ name: "", loginId: "", password: "", role: "RECEPTION" });
      showToast("スタッフ追加", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "追加失敗", "error");
    } finally {
      setBusy(false);
    }
  };

  const GRID_CLASS = [
    "grid-cols-[minmax(5rem,6rem)_minmax(10rem,1fr)_minmax(5rem,0.6fr)_minmax(5rem,0.6fr)_minmax(8rem,max-content)]",
    "md:grid-cols-[minmax(6rem,7rem)_minmax(12rem,1fr)_minmax(5.5rem,0.55fr)_minmax(5.5rem,0.55fr)_minmax(7rem,0.7fr)_minmax(8rem,max-content)]",
  ].join(" ");

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-base text-slate-700">
          <span>スタッフ</span>
          <span className="text-lg font-semibold text-slate-900">
            {users.length}
          </span>
          <span>名</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="list" variant="outline" onClick={openRecoveryModal}>
            復旧コード再発行
          </Button>
          <Button size="list" onClick={() => setAddOpen(true)}>
            新規追加
          </Button>
        </div>
      </div>

      {/* スタッフ一覧 */}
      <ListPanel className="p-0">
        <ListHeader
          className={`px-[var(--space-4)] sm:px-[var(--space-5)] lg:px-[var(--space-6)] py-[var(--space-2)] text-slate-700 grid gap-2 ${GRID_CLASS}`}
        >
          <div>氏名</div>
          <div>ログインID</div>
          <div>ロール</div>
          <div>状態</div>
          <div className="hidden md:block">最終ログイン</div>
          <div className="text-right">操作</div>
        </ListHeader>
        <div className="divide-y divide-slate-100">
          {users.map((u) => (
            <div
              key={u.id}
              className={`px-[var(--space-4)] sm:px-[var(--space-5)] lg:px-[var(--space-6)] py-[var(--space-2)] grid items-center gap-2 text-base hover:bg-slate-50 transition-colors ${GRID_CLASS}`}
            >
              <div className="font-medium text-slate-900 truncate">
                {u.name}
              </div>
              <div className="text-sm text-slate-600 truncate font-mono">
                {u.email}
              </div>
              <div>
                <RoleSelect
                  current={u.role}
                  onSelect={(r) => handleRoleChange(u, r)}
                  disableAdmin={adminLocked && u.role !== "ADMIN"}
                />
              </div>
              <div>
                <StatusSelect
                  current={u.status}
                  onSelect={(s) => handleStatusChange(u, s)}
                />
              </div>
              <div className="hidden md:block text-sm text-slate-500 whitespace-nowrap">
                {u.lastLoginAt
                  ? format(new Date(u.lastLoginAt), "MM/dd HH:mm")
                  : "—"}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                {u.lockedUntil && (
                  <Button
                    size="list"
                    variant="outline"
                    onClick={() => handleUnlock(u)}
                  >
                    解除
                  </Button>
                )}
                <Button
                  size="list"
                  variant="outline"
                  onClick={() => handlePasswordReset(u)}
                >
                  PW変更
                </Button>
                <Button
                  size="list"
                  variant="outline"
                  onClick={() => handleDelete(u)}
                >
                  削除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ListPanel>

      <ConfirmModal
        open={!!confirm}
        title={
          confirm?.kind === "delete"
            ? "アカウント削除"
            : confirm?.kind === "role"
              ? "ロール変更"
              : "ステータス変更"
        }
        description={
          confirm?.kind === "delete"
            ? `${confirm.value} を削除しますか？`
            : `変更後: ${confirm?.value}`
        }
        confirmLabel={confirm?.kind === "delete" ? "削除" : "変更"}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <AccessibleModal
        isOpen={!!resetUser}
        onClose={() => setResetUser(null)}
        title="パスワード再設定"
        description={resetUser ? `${resetUser.name}` : ""}
        size="sm"
      >
        <div className="space-y-4">
          <input
            type="password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新しいパスワード（4文字以上）"
            minLength={4}
            maxLength={128}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setResetUser(null)}
              disabled={busy}
            >
              キャンセル
            </Button>
            <Button
              onClick={submitPasswordReset}
              disabled={busy || !newPassword}
            >
              {busy ? "更新中..." : "更新"}
            </Button>
          </div>
        </div>
      </AccessibleModal>

      <AccessibleModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="スタッフ追加"
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="氏名"
            />
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newUser.loginId}
              onChange={(e) =>
                setNewUser({ ...newUser, loginId: e.target.value })
              }
              placeholder="ログインID（4文字以上）"
              minLength={4}
            />
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newUser.password}
              onChange={(e) =>
                setNewUser({ ...newUser, password: e.target.value })
              }
              placeholder="パスワード（4文字以上）"
              minLength={4}
            />
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newUser.role}
              onChange={(e) =>
                setNewUser({
                  ...newUser,
                  role: e.target.value as UserRow["role"],
                })
              }
            >
              <option value="RECEPTION">受付</option>
              <option value="PRACTITIONER">柔整師</option>
              <option value="SECURITY_ADMIN">セキュリティ管理者</option>
              <option value="ADMIN" disabled={adminLocked}>
                管理者
              </option>
            </select>
            {adminLocked && (
              <p className="text-xs text-slate-500">
                管理者は1人のみ設定できます。
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={busy}
            >
              キャンセル
            </Button>
            <Button
              onClick={submitAddUser}
              disabled={
                busy || !newUser.name || !newUser.loginId || !newUser.password
              }
            >
              {busy ? "追加中..." : "追加"}
            </Button>
          </div>
        </div>
      </AccessibleModal>

      <AccessibleModal
        isOpen={recoveryOpen}
        onClose={() => {
          if (recoveryCodeValue && !recoveryConfirmed) return;
          setRecoveryOpen(false);
        }}
        title="復旧コード再発行"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            復旧コードは管理者パスワードを忘れた場合の唯一の復旧手段です。再発行すると旧コードは無効になります。
          </p>

          {!recoveryCodeValue ? (
            <div className="space-y-3">
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-inner focus:border-slate-400 focus:outline-none"
                value={recoveryMfaCode}
                onChange={(e) => setRecoveryMfaCode(e.target.value)}
                placeholder="MFA認証コード"
                inputMode="numeric"
              />
              {recoveryError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {recoveryError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRecoveryOpen(false)}
                  disabled={recoveryBusy}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={submitRecoveryRegenerate}
                  disabled={recoveryBusy || !recoveryMfaCode.trim()}
                >
                  {recoveryBusy ? "再発行中..." : "再発行"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center">
                <div className="text-[11px] uppercase text-slate-500 tracking-widest">
                  Recovery Code
                </div>
                <div className="mt-2 font-mono text-sm tracking-[0.25em] text-slate-900 whitespace-nowrap">
                  {recoveryCodeValue}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleCopyRecoveryCode}
                    className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    コピー
                  </button>
                </div>
              </div>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={recoveryConfirmed}
                  onChange={(e) => setRecoveryConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-slate-900"
                />
                <span className="block font-medium text-slate-800">
                  復旧コードを安全な場所に保存しました
                </span>
              </label>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (!recoveryConfirmed) return;
                    setRecoveryOpen(false);
                  }}
                  disabled={!recoveryConfirmed}
                >
                  完了
                </Button>
              </div>
            </div>
          )}
        </div>
      </AccessibleModal>
    </div>
  );
}

function RoleSelect({
  current,
  onSelect,
  disableAdmin,
}: {
  current: UserRow["role"];
  onSelect: (r: UserRow["role"]) => void;
  disableAdmin: boolean;
}) {
  const options: UserRow["role"][] = [
    "ADMIN",
    "SECURITY_ADMIN",
    "PRACTITIONER",
    "RECEPTION",
  ];
  return (
    <div className="relative inline-flex items-center">
      <select
        className="appearance-none bg-transparent pr-5 text-sm text-slate-700 cursor-pointer focus:outline-none"
        value={current}
        onChange={(e) => onSelect(e.target.value as UserRow["role"])}
      >
        {options.map((o) => (
          <option key={o} value={o} disabled={o === "ADMIN" && disableAdmin}>
            {roleLabel[o]}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-0 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
}

function StatusSelect({
  current,
  onSelect,
}: {
  current: UserRow["status"];
  onSelect: (s: UserRow["status"]) => void;
}) {
  const options: UserRow["status"][] = ["ACTIVE", "SUSPENDED", "DELETED"];
  return (
    <div className="relative inline-flex items-center">
      <select
        className="appearance-none bg-transparent pr-5 text-sm text-slate-700 cursor-pointer focus:outline-none"
        value={current}
        onChange={(e) => onSelect(e.target.value as UserRow["status"])}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {statusLabel[o]}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-0 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
}

/* ===== バックアップタブ ===== */
function BackupTab() {
  const [isRestarting, setIsRestarting] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreTargetBackup, setRestoreTargetBackup] = useState<Backup | null>(
    null,
  );
  const [restoreInput, setRestoreInput] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState<string>("");
  const [locationStatus, setLocationStatus] =
    useState<BackupLocationStatus | null>(null);
  const [externalBackupMissingAt, setExternalBackupMissingAt] =
    useState<string>("");
  const [lastExternalBackupAt, setLastExternalBackupAt] = useState<string>("");
  const [customBackupMissingAt, setCustomBackupMissingAt] =
    useState<string>("");
  const [lastCustomBackupAt, setLastCustomBackupAt] = useState<string>("");
  const [missingStatus, setMissingStatus] =
    useState<BackupMissingStatus | null>(null);
  const [backupNotice, setBackupNotice] = useState<{
    message: string;
  } | null>(null);
  const restoreCompletedKey = "voss_restore_completed_at";

  useEffect(() => {
    if (!backupNotice) return;
    const timer = window.setTimeout(() => {
      setBackupNotice(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [backupNotice]);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/backup");
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
        setLastBackupAt(data.lastBackupAt || "");
        if (data.locationStatus) {
          setLocationStatus(data.locationStatus as BackupLocationStatus);
        }
        if (data.missingStatus) {
          setMissingStatus(data.missingStatus as BackupMissingStatus);
        }
        setExternalBackupMissingAt(data.externalBackupMissingAt || "");
        setLastExternalBackupAt(data.lastExternalBackupAt || "");
        setCustomBackupMissingAt(data.customBackupMissingAt || "");
        setLastCustomBackupAt(data.lastCustomBackupAt || "");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleRefreshStatus = () => {
    void fetchBackups();
  };

  const handleCreate = async () => {
    setProcessing("create");
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encrypted: true }),
      });
      if (res.ok) {
        await fetchBackups();
        setBackupNotice({ message: "バックアップを作成しました" });
      } else {
        const error = await res.json();
        setBackupNotice({ message: error.error || "作成失敗" });
      }
    } catch {
      setBackupNotice({ message: "作成失敗" });
    } finally {
      setProcessing(null);
    }
  };

  const handleImportLegacy = async () => {
    if (processing) return;
    setBackupNotice(null);
    setProcessing("import");
    try {
      const res = await fetch("/api/backup/import", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await fetchBackups();
        const importedCount =
          typeof data.imported === "number" ? data.imported : 0;
        if (importedCount > 0) {
          setBackupNotice({
            message: `過去バックアップを${importedCount}件取り込みました`,
          });
        } else {
          setBackupNotice({
            message: "取り込み対象はありません",
          });
        }
      } else {
        const error = await res.json();
        setBackupNotice({
          message: error.error || "取り込み失敗",
        });
      }
    } catch {
      setBackupNotice({
        message: "取り込み失敗",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      const res = await fetch(
        `/api/backup/download?fileName=${encodeURIComponent(fileName)}`,
      );
      if (!res.ok) throw new Error("ダウンロード失敗");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setBackupNotice({ message: "ダウンロード失敗" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const latestBackup = backups[0];
  const lastBackupAtLabel =
    lastBackupAt && !Number.isNaN(Date.parse(lastBackupAt))
      ? format(new Date(lastBackupAt), "yyyy/MM/dd HH:mm")
      : "なし";
  const lastExternalBackupLabel =
    lastExternalBackupAt && !Number.isNaN(Date.parse(lastExternalBackupAt))
      ? format(new Date(lastExternalBackupAt), "yyyy/MM/dd HH:mm")
      : "なし";
  const lastCustomBackupLabel =
    lastCustomBackupAt && !Number.isNaN(Date.parse(lastCustomBackupAt))
      ? format(new Date(lastCustomBackupAt), "yyyy/MM/dd HH:mm")
      : "なし";

  const latestBackupSizeLabel = latestBackup
    ? formatSize(latestBackup.fileSize)
    : "—";

  const SOURCE_LABELS: Record<BackupLocationStatus["activeSource"], string> = {
    external: "外部ストレージ",
    default: "ローカル（既定）",
    custom: "指定フォルダ",
  };
  const activeSourceLabel = locationStatus
    ? SOURCE_LABELS[locationStatus.activeSource]
    : "—";
  const preferredSourceLabel = locationStatus
    ? SOURCE_LABELS[locationStatus.preferredSource]
    : "—";
  const directoryLabel = locationStatus?.directory ?? "—";
  const backupCountLabel = `${backups.length}件`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  // 最終バックアップから7日以上経過しているかチェック
  const needsExternalBackup = latestBackup
    ? new Date().getTime() - new Date(latestBackup.createdAt).getTime() >
      7 * 24 * 60 * 60 * 1000
    : true;

  const showAlerts =
    needsExternalBackup ||
    (locationStatus?.preferredSource === "external" &&
      !locationStatus.externalAvailable) ||
    (locationStatus?.preferredSource === "custom" &&
      !locationStatus.customAvailable) ||
    Boolean(
      missingStatus?.required &&
        missingStatus.isMissing &&
        missingStatus.daysMissing >= missingStatus.alertAfterDays,
    );

  const executeRestore = async () => {
    if (!restoreTargetBackup || restoreInput !== "復元") return;
    setShowRestoreConfirm(false);
    setRestoreTargetBackup(null);
    setRestoreInput("");
    setProcessing("restore");
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: restoreTargetBackup.fileName }),
      });
      if (res.ok) {
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              restoreCompletedKey,
              new Date().toISOString(),
            );
          }
        } catch {
          // ignore storage errors
        }
        setIsRestarting(true);
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (typeof window !== "undefined" && window.electronAPI?.restartApp) {
          window.electronAPI.restartApp();
          return;
        }
        window.location.reload();
      } else {
        const error = await res.json();
        setBackupNotice({ message: error.error || "復元失敗" });
      }
    } catch {
      setBackupNotice({ message: "復元失敗" });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-4">
      {isRestarting && (
        <div
          className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center"
          role="alertdialog"
          aria-modal="true"
          aria-live="polite"
        >
          <div className="rounded-2xl bg-white shadow-xl px-6 py-5 text-center max-w-sm w-full mx-4">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <RefreshCw className="h-6 w-6 text-slate-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">再起動中…</h3>
            <p className="mt-2 text-sm text-slate-600">
              復元が完了しました。データ反映のため再起動しています。
            </p>
          </div>
        </div>
      )}

      {/* 重要なアラートのみ表示 */}
      {missingStatus?.required &&
        missingStatus.isMissing &&
        missingStatus.daysMissing >= missingStatus.alertAfterDays && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            外部保存が{missingStatus.daysMissing}日以上行われていません
          </div>
        )}

      {/* バックアップ情報と操作 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-slate-600">保存先: </span>
            <span className="font-medium text-slate-900">
              {activeSourceLabel}
            </span>
          </div>
          <div>
            <span className="text-slate-600">保存数: </span>
            <span className="font-medium text-slate-900">
              {backupCountLabel}
            </span>
          </div>
          {latestBackup && (
            <div>
              <span className="text-slate-600">サイズ: </span>
              <span className="font-medium text-slate-900">
                {latestBackupSizeLabel}
              </span>
            </div>
          )}
          {locationStatus?.fallbackUsed && (
            <div>
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                フォールバック中
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="list"
            variant="outline"
            onClick={handleImportLegacy}
            disabled={!!processing}
          >
            {processing === "import"
              ? "取り込み中..."
              : "過去バックアップを再取り込み"}
          </Button>
          {latestBackup && (
            <>
              <Button
                size="list"
                variant="outline"
                onClick={() => handleDownload(latestBackup.fileName)}
              >
                外部に保存
              </Button>
              <Button
                size="list"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => {
                  setRestoreTargetBackup(latestBackup);
                  setShowRestoreConfirm(true);
                }}
                disabled={!!processing}
              >
                復元
              </Button>
            </>
          )}
          <Button
            size="list"
            onClick={handleCreate}
            disabled={processing === "create"}
          >
            {processing === "create" ? "作成中..." : "今すぐバックアップ"}
          </Button>
        </div>
      </div>
      {(locationStatus?.preferredSource === "external" &&
        !locationStatus.externalAvailable) ||
      (locationStatus?.preferredSource === "custom" &&
        !locationStatus.customAvailable) ? (
        <div className="text-xs text-amber-800">
          {locationStatus.preferredSource === "external"
            ? `外部ストレージが検出されていません（最終: ${lastExternalBackupLabel}）`
            : `指定フォルダが見つかりません（最終: ${lastCustomBackupLabel}）`}
          <button
            className="ml-2 underline font-medium"
            onClick={handleRefreshStatus}
          >
            再検出
          </button>
        </div>
      ) : null}
      {backupNotice && (
        <div className="text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 px-3 py-2 flex items-start justify-between gap-3">
          <span>{backupNotice.message}</span>
          <button
            className="text-current opacity-70 hover:opacity-100"
            onClick={() => setBackupNotice(null)}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}
      {needsExternalBackup && (
        <div className="text-xs text-amber-800">
          週1回、バックアップファイルを外部ストレージ（USB等）に保存してください
        </div>
      )}

      {/* バックアップ履歴 */}
      <ListPanel className="p-0">
        <ListHeader className="px-4 py-3">
          <span className="font-medium text-slate-800">バックアップ履歴</span>
        </ListHeader>
        <div className="divide-y divide-slate-100">
          {backups.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              バックアップがありません
            </div>
          ) : (
            backups.map((backup) => {
              const backupDateLabel =
                backup && !Number.isNaN(Date.parse(backup.createdAt))
                  ? format(new Date(backup.createdAt), "yyyy/MM/dd HH:mm")
                  : "—";
              const backupSizeLabel = formatSize(backup.fileSize);
              return (
                <div
                  key={backup.fileName}
                  className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
                >
                  <span className="text-base font-medium text-slate-900">
                    {backupDateLabel}
                  </span>
                  <span className="text-slate-600">{backupSizeLabel}</span>
                  {backup.description && (
                    <span className="text-slate-600 truncate max-w-[12rem]">
                      {backup.description}
                    </span>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      size="list"
                      variant="outline"
                      onClick={() => handleDownload(backup.fileName)}
                    >
                      外部に保存
                    </Button>
                    <Button
                      size="list"
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setRestoreTargetBackup(backup);
                        setShowRestoreConfirm(true);
                      }}
                      disabled={!!processing}
                    >
                      復元
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ListPanel>

      {/* 復元確認モーダル */}
      <AccessibleModal
        isOpen={showRestoreConfirm}
        onClose={() => {
          setShowRestoreConfirm(false);
          setRestoreTargetBackup(null);
          setRestoreInput("");
        }}
        title="バックアップから復元"
        size="sm"
      >
        <div className="space-y-4">
          {restoreTargetBackup && (
            <div className="text-sm text-slate-700">
              復元対象:{" "}
              <span className="font-medium text-slate-900">
                {format(
                  new Date(restoreTargetBackup.createdAt),
                  "yyyy/MM/dd HH:mm",
                )}
              </span>
            </div>
          )}
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <strong>警告:</strong>{" "}
            現在のデータは完全に上書きされます。この操作は取り消せません。
          </div>

          <details className="rounded-lg border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700">
              復元の仕組みについて
            </summary>
            <div className="px-3 pb-3 pt-2 text-xs text-slate-600 space-y-2">
              <p>
                <strong>安全な復元</strong>:
                復元前に現在のデータベースが自動的にバックアップされます。
                復元に失敗した場合でも、このバックアップから復旧できます。
              </p>
              <p>
                <strong>整合性チェック</strong>:
                復元後、データベースの整合性が自動的にチェックされます。
                破損が検出された場合、復元は失敗します。
              </p>
              <p>
                <strong>復元前バックアップの場所</strong>:
                ログに記録されます（[BackupRestore] Pre-restore backup created:
                &lt;path&gt;）。
              </p>
            </div>
          </details>

          <div>
            <label className="block text-sm text-slate-700 mb-2">
              確認のため「復元」と入力してください
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={restoreInput}
              onChange={(e) => setRestoreInput(e.target.value)}
              placeholder="復元"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="list"
              variant="outline"
              onClick={() => {
                setShowRestoreConfirm(false);
                setRestoreInput("");
              }}
            >
              キャンセル
            </Button>
            <Button
              size="list"
              onClick={executeRestore}
              disabled={restoreInput !== "復元" || processing === "restore"}
              className={
                restoreInput === "復元" ? "bg-red-600 hover:bg-red-700" : ""
              }
            >
              {processing === "restore" ? "復元中..." : "復元を実行"}
            </Button>
          </div>
        </div>
      </AccessibleModal>
    </div>
  );
}
