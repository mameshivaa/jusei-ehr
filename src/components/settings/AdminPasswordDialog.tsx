"use client";

import { useEffect, useState } from "react";
import AccessibleModal from "@/components/ui/AccessibleModal";
import { Button } from "@/components/ui/button";

interface AdminPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<boolean>;
  action: string; // "拡張機能のインストール" など
  loading?: boolean;
}

export default function AdminPasswordDialog({
  open,
  onClose,
  onConfirm,
  action,
  loading = false,
}: AdminPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError("パスワードを入力してください");
      return;
    }

    setError(null);
    const valid = await onConfirm(password);
    if (!valid) {
      setError("パスワードが正しくありません");
      return;
    }

    setPassword("");
    onClose();
  };

  return (
    <AccessibleModal
      isOpen={open}
      onClose={onClose}
      title="管理者認証"
      description={`${action}を実行するには、管理者パスワードの入力が必要です`}
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            パスワード
          </label>
          <input
            type="password"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="管理者パスワード"
          />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={loading}>
            確認
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
