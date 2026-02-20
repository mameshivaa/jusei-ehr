"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";

export type TemplateFields = {
  narrative?: string | null;
};

type Template = TemplateFields & {
  id: string;
  title: string;
  updatedAt: string;
};

type Props = {
  onApply: (fields: TemplateFields) => void;
  getCurrentValues: () => TemplateFields;
};

export function TemplatePanel({ onApply, getCurrentValues }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/records/templates", { cache: "no-store" });
      if (res.ok) {
        setTemplates(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const title = window.prompt("テンプレート名を入力してください");
    if (!title) return;
    setSaving(true);
    try {
      const values = getCurrentValues();
      const res = await fetch("/api/records/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ...values }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存に失敗しました");
      }
      await fetchTemplates();
      alert("テンプレートを保存しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("このテンプレートを削除しますか？");
    if (!ok) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/records/templates?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "削除に失敗しました");
      }
      await fetchTemplates();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            テンプレート
          </div>
          <div className="text-xs text-slate-500">
            記録内容の定型文を保存・適用
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          loading={saving}
        >
          <Plus className="h-4 w-4" />
          <span className="ml-1">現在の内容を保存</span>
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">読み込み中...</div>
      ) : templates.length === 0 ? (
        <EmptyState
          title="テンプレートがありません"
          description="フォームを入力して「現在の内容を保存」を押してください"
        />
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2",
              )}
            >
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {t.title}
                </div>
                <div className="text-[11px] text-slate-500">
                  更新: {new Date(t.updatedAt).toLocaleString("ja-JP")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onApply(t)}
                >
                  <Download className="h-4 w-4" />
                  <span className="ml-1">適用</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
