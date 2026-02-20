"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, ChevronDown, Unlock, ShieldAlert } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import AccessibleModal from "@/components/ui/AccessibleModal";

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

export default function UsersClient({
  initialUsers,
}: {
  initialUsers: UserRow[];
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [confirm, setConfirm] = useState<{
    userId: string;
    kind: "role" | "status";
    value: string;
  } | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const updateUserLocal = (id: string, patch: Partial<UserRow>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const request = async (path: string, method: string, body: any) => {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "更新に失敗しました");
    return data;
  };

  const handleRoleChange = (user: UserRow, role: UserRow["role"]) => {
    setConfirm({ userId: user.id, kind: "role", value: role });
  };

  const handleStatusChange = (user: UserRow, status: UserRow["status"]) => {
    setConfirm({ userId: user.id, kind: "status", value: status });
  };

  const handleUnlock = async (user: UserRow) => {
    try {
      await request(`/api/admin/users/${user.id}/unlock`, "POST", {
        reason: "manual unlock",
      });
      updateUserLocal(user.id, { failedLoginCount: 0, lockedUntil: null });
      showToast("アカウントロックを解除しました", "success");
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "ロック解除に失敗しました",
        "error",
      );
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
        showToast("ロールを変更しました", "success");
      } else {
        await request(`/api/admin/users/${userId}/status`, "PUT", {
          status: value,
        });
        updateUserLocal(userId, { status: value as UserRow["status"] });
        showToast("ステータスを変更しました", "success");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "更新に失敗しました", "error");
    } finally {
      setConfirm(null);
    }
  };

  const handlePasswordReset = (user: UserRow) => {
    setResetUser(user);
    setNewPassword("");
  };

  const submitPasswordReset = async () => {
    if (!resetUser || !newPassword) return;
    setBusy(true);
    try {
      await request(`/api/admin/users/${resetUser.id}/password`, "PUT", {
        password: newPassword,
      });
      showToast("パスワードを更新しました", "success");
      setResetUser(null);
      setNewPassword("");
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "パスワード更新に失敗しました",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm text-slate-600">
        ユーザー数: {users.length}
      </div>
      <div className="overflow-x-auto">
        <DataTable
          density="compact"
          headers={[
            "氏名/メール",
            "ロール",
            "状態",
            "MFA",
            "最終ログイン",
            "操作",
          ]}
          columnClasses={[
            "w-2/5",
            "w-1/6",
            "w-1/6",
            "w-1/12",
            "w-1/6",
            "w-1/5",
          ]}
          rows={users.map((u) => [
            <div key="name" className="space-y-0.5">
              <div className="font-semibold text-slate-900">{u.name}</div>
              <div className="text-xs text-slate-500">{u.email}</div>
              <div className="text-[11px] text-slate-400">
                作成: {format(new Date(u.createdAt), "yyyy/MM/dd HH:mm")}
              </div>
            </div>,
            <div
              key="role"
              className="text-sm text-slate-800 flex items-center gap-2"
            >
              {roleLabel[u.role]}
              <RoleDropdown
                current={u.role}
                onSelect={(r) => handleRoleChange(u, r)}
              />
            </div>,
            <div
              key="status"
              className="text-sm text-slate-800 flex items-center gap-2"
            >
              {statusLabel[u.status]}
              <StatusDropdown
                current={u.status}
                onSelect={(s) => handleStatusChange(u, s)}
              />
            </div>,
            <div key="mfa" className="text-sm text-slate-800">
              {u.mfaEnabled ? "有効" : "—"}
            </div>,
            <div key="last" className="text-sm text-slate-700">
              {u.lastLoginAt
                ? format(new Date(u.lastLoginAt), "MM/dd HH:mm")
                : "—"}
            </div>,
            <div key="ops" className="flex items-center gap-2">
              {u.lockedUntil ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleUnlock(u)}
                >
                  <Unlock className="h-4 w-4" />
                  <span className="ml-1">ロック解除</span>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePasswordReset(u)}
              >
                <ShieldAlert className="h-4 w-4" />
                <span className="ml-1 text-xs">パスワード再設定</span>
              </Button>
            </div>,
          ])}
        />
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.kind === "role" ? "ロールを変更" : "ステータスを変更"}
        description={confirm ? `変更後: ${confirm.value}` : ""}
        confirmLabel="変更する"
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <AccessibleModal
        isOpen={!!resetUser}
        onClose={() => setResetUser(null)}
        title="パスワード再設定"
        description={resetUser ? `${resetUser.name} (${resetUser.email})` : ""}
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              新しいパスワード
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={4}
              maxLength={128}
            />
            <p className="text-xs text-slate-500">
              4〜128文字。メール送信は行われません。
            </p>
          </div>
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
              {busy ? "更新中..." : "更新する"}
            </Button>
          </div>
        </div>
      </AccessibleModal>
    </div>
  );
}

function RoleDropdown({
  current,
  onSelect,
}: {
  current: UserRow["role"];
  onSelect: (r: UserRow["role"]) => void;
}) {
  const options: UserRow["role"][] = [
    "ADMIN",
    "SECURITY_ADMIN",
    "PRACTITIONER",
    "RECEPTION",
  ];
  return (
    <div className="relative inline-flex items-center">
      <ChevronDown className="h-4 w-4 text-slate-400" />
      <select
        className="appearance-none bg-transparent pl-4 pr-6 text-sm text-slate-700 focus:outline-none"
        value={current}
        onChange={(e) => onSelect(e.target.value as UserRow["role"])}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {roleLabel[o]}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusDropdown({
  current,
  onSelect,
}: {
  current: UserRow["status"];
  onSelect: (s: UserRow["status"]) => void;
}) {
  const options: UserRow["status"][] = ["ACTIVE", "SUSPENDED", "DELETED"];
  return (
    <div className="relative inline-flex items-center">
      <ShieldAlert className="h-4 w-4 text-slate-400" />
      <select
        className="appearance-none bg-transparent pl-4 pr-6 text-sm text-slate-700 focus:outline-none"
        value={current}
        onChange={(e) => onSelect(e.target.value as UserRow["status"])}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {statusLabel[o]}
          </option>
        ))}
      </select>
    </div>
  );
}
