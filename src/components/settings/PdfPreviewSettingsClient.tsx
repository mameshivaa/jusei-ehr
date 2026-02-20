"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListPanel, ListHeader } from "@/components/ui/ListPanel";
import { useToast } from "@/components/ui/ToastProvider";

type PdfSettings = {
  pdfPreviewIncludeOutputTimestamp: boolean;
  pdfPreviewIncludePatientName: boolean;
  pdfPreviewIncludePatientId: boolean;
  pdfPreviewIncludeInsurance: boolean;
  pdfPreviewIncludeStatus: boolean;
  pdfPreviewIncludeFirstVisitDate: boolean;
  pdfPreviewIncludeRecordHeaderDate: boolean;
  pdfPreviewIncludeRecordHeaderMilestone: boolean;
  pdfPreviewIncludeRecordHeaderUpdatedAt: boolean;
  pdfPreviewIncludeRecordHeaderAuthor: boolean;
  pdfPreviewIncludeRecordContent: boolean;
  pdfPreviewIncludeRecordHistory: boolean;
  pdfPreviewIncludeRecordInjury: boolean;
  pdfPreviewIncludeRecordInjuryDate: boolean;
  pdfPreviewIncludeTreatmentDetails: boolean;
};

const DEFAULT_SETTINGS: PdfSettings = {
  pdfPreviewIncludeOutputTimestamp: true,
  pdfPreviewIncludePatientName: true,
  pdfPreviewIncludePatientId: true,
  pdfPreviewIncludeInsurance: true,
  pdfPreviewIncludeStatus: true,
  pdfPreviewIncludeFirstVisitDate: true,
  pdfPreviewIncludeRecordHeaderDate: true,
  pdfPreviewIncludeRecordHeaderMilestone: true,
  pdfPreviewIncludeRecordHeaderUpdatedAt: true,
  pdfPreviewIncludeRecordHeaderAuthor: true,
  pdfPreviewIncludeRecordContent: true,
  pdfPreviewIncludeRecordHistory: false,
  pdfPreviewIncludeRecordInjury: false,
  pdfPreviewIncludeRecordInjuryDate: false,
  pdfPreviewIncludeTreatmentDetails: false,
};

export default function PdfPreviewSettingsClient({
  initialSettings,
  onSaved,
  compact = false,
}: {
  initialSettings: Partial<PdfSettings>;
  onSaved?: (settings: PdfSettings) => void;
  compact?: boolean;
}) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<PdfSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, ...initialSettings }));
  }, [initialSettings]);

  const sections = useMemo(
    () => [
      {
        title: "カルテ概要",
        items: [
          {
            key: "pdfPreviewIncludeOutputTimestamp",
            label: "出力日時",
          },
          {
            key: "pdfPreviewIncludePatientName",
            label: "患者名・フリガナ",
          },
          {
            key: "pdfPreviewIncludePatientId",
            label: "患者ID",
          },
          {
            key: "pdfPreviewIncludeInsurance",
            label: "保険区分",
          },
          {
            key: "pdfPreviewIncludeStatus",
            label: "ステータス",
          },
          {
            key: "pdfPreviewIncludeFirstVisitDate",
            label: "初検日",
          },
        ],
      },
      {
        title: "施術録ヘッダー",
        items: [
          {
            key: "pdfPreviewIncludeRecordHeaderDate",
            label: "日付",
          },
          {
            key: "pdfPreviewIncludeRecordHeaderMilestone",
            label: "経過（週数）",
          },
          {
            key: "pdfPreviewIncludeRecordHeaderUpdatedAt",
            label: "更新日時",
          },
          {
            key: "pdfPreviewIncludeRecordHeaderAuthor",
            label: "記録者",
          },
        ],
      },
      {
        title: "施術録本文",
        items: [
          {
            key: "pdfPreviewIncludeRecordContent",
            label: "内容",
          },
          {
            key: "pdfPreviewIncludeRecordHistory",
            label: "履歴（変更前後・変更者）",
          },
          {
            key: "pdfPreviewIncludeRecordInjury",
            label: "負傷名",
          },
          {
            key: "pdfPreviewIncludeRecordInjuryDate",
            label: "負傷日",
          },
          {
            key: "pdfPreviewIncludeTreatmentDetails",
            label: "施術明細",
          },
        ],
      },
    ],
    [],
  );

  const toggle = (key: keyof PdfSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/pdf-preview", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      const next = await res.json();
      const parsed = Object.fromEntries(
        Object.entries(next).map(([key, value]) => [key, value === "true"]),
      ) as PdfSettings;
      setSettings((prev) => ({ ...prev, ...parsed }));
      setDirty(false);
      onSaved?.(parsed);
      showToast("保存しました", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderActions = (size: "sm" | "md") => (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size={size}
        onClick={() => {
          setSettings({ ...DEFAULT_SETTINGS, ...initialSettings });
          setDirty(true);
        }}
      >
        既定に戻す
      </Button>
      <Button size={size} onClick={handleSave} disabled={saving || !dirty}>
        {saving ? "保存中..." : "保存"}
      </Button>
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-lg border border-slate-200 bg-white"
          >
            <div className="px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-100 bg-slate-50">
              {section.title}
            </div>
            <div className="grid gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-2">
              {section.items.map((item) => {
                const key = item.key as keyof PdfSettings;
                return (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer"
                  >
                    <span className="leading-5">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={() => toggle(key)}
                      className="h-4 w-4 accent-slate-800"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {renderActions("sm")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <ListPanel key={section.title} className="p-0">
          <ListHeader className="px-4 py-3">
            <span className="font-medium text-slate-800">{section.title}</span>
          </ListHeader>
          <div className="divide-y divide-slate-100">
            {section.items.map((item) => {
              const key = item.key as keyof PdfSettings;
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700 cursor-pointer"
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 accent-slate-800"
                  />
                </label>
              );
            })}
          </div>
        </ListPanel>
      ))}

      {renderActions("md")}
    </div>
  );
}
