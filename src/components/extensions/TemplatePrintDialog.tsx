"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Printer, FileText, Loader2, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import AccessibleModal from "@/components/ui/AccessibleModal";
import type { ContextualTemplate } from "@/lib/extensions";

// =============================================================================
// 型定義
// =============================================================================

interface TemplatePrintDialogProps {
  /** ダイアログが開いているか */
  isOpen: boolean;
  /** 閉じるコールバック */
  onClose: () => void;
  /** 対象エンティティの種類 */
  entityType: "patient" | "chart" | "visit" | "treatmentRecord";
  /** エンティティID */
  entityId: string;
  /** エンティティ名（表示用） */
  entityName?: string;
}

// =============================================================================
// コンポーネント
// =============================================================================

export default function TemplatePrintDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
}: TemplatePrintDialogProps) {
  const [templates, setTemplates] = useState<ContextualTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ContextualTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // テンプレート一覧を取得
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      setSelectedTemplate(null);
      setRenderedHtml(null);

      fetch(`/api/extensions/templates?targetEntity=${entityType}&type=print`)
        .then((res) => res.json())
        .then((data) => {
          setTemplates(data.templates || []);
        })
        .catch((e) => {
          console.error("Failed to fetch templates:", e);
          setError("テンプレートの取得に失敗しました");
          setTemplates([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, entityType]);

  // テンプレートを選択してレンダリング
  const handleSelectTemplate = useCallback(
    async (template: ContextualTemplate) => {
      setSelectedTemplate(template);
      setRendering(true);
      setError(null);
      setRenderedHtml(null);

      try {
        const res = await fetch("/api/extensions/templates/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: template.id,
            entityType,
            entityId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "レンダリングに失敗しました");
        } else {
          setRenderedHtml(data.html);
        }
      } catch (e) {
        setError("レンダリングに失敗しました");
      } finally {
        setRendering(false);
      }
    },
    [entityType, entityId],
  );

  // 印刷
  const handlePrint = useCallback(() => {
    if (!renderedHtml) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(renderedHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }, [renderedHtml]);

  // 新しいタブで開く
  const handleOpenInNewTab = useCallback(() => {
    if (!renderedHtml) return;

    const blob = new Blob([renderedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [renderedHtml]);

  // 戻る
  const handleBack = useCallback(() => {
    setSelectedTemplate(null);
    setRenderedHtml(null);
    setError(null);
  }, []);

  const entityTypeLabel = {
    patient: "患者",
    chart: "カルテ",
    visit: "来院",
    treatmentRecord: "施術記録",
  }[entityType];

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedTemplate ? selectedTemplate.name : "印刷テンプレート選択"}
      description={
        selectedTemplate
          ? `${entityTypeLabel}: ${entityName || entityId}`
          : `${entityTypeLabel}の印刷テンプレートを選択してください`
      }
      size="xl"
    >
      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* テンプレート選択画面 */}
      {!selectedTemplate && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              テンプレートを読み込み中...
            </div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <FileText className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p>利用可能なテンプレートがありません</p>
              <p className="text-xs mt-1 text-slate-400">
                拡張機能でテンプレートを追加してください
              </p>
            </div>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left"
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900">
                    {template.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {template.extensionName}
                    {template.description && ` · ${template.description}`}
                  </div>
                </div>
                <Printer className="h-4 w-4 text-slate-400" />
              </button>
            ))
          )}
        </div>
      )}

      {/* プレビュー画面 */}
      {selectedTemplate && (
        <div className="space-y-4">
          {rendering ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              プレビューを生成中...
            </div>
          ) : renderedHtml ? (
            <>
              {/* プレビュー */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <iframe
                  srcDoc={renderedHtml}
                  className="w-full h-[50vh] border-0"
                  title="印刷プレビュー"
                />
              </div>

              {/* アクションボタン */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={handleBack}>
                  ← 戻る
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleOpenInNewTab}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    新しいタブで開く
                  </Button>
                  <Button variant="primary" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-1" />
                    印刷
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </AccessibleModal>
  );
}

// =============================================================================
// フック: 印刷ダイアログを開くためのヘルパー
// =============================================================================

export function useTemplatePrintDialog() {
  const [state, setState] = useState<{
    isOpen: boolean;
    entityType: "patient" | "chart" | "visit" | "treatmentRecord";
    entityId: string;
    entityName?: string;
  }>({
    isOpen: false,
    entityType: "patient",
    entityId: "",
  });

  const openPrintDialog = useCallback(
    (
      entityType: "patient" | "chart" | "visit" | "treatmentRecord",
      entityId: string,
      entityName?: string,
    ) => {
      setState({
        isOpen: true,
        entityType,
        entityId,
        entityName,
      });
    },
    [],
  );

  const closePrintDialog = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    ...state,
    openPrintDialog,
    closePrintDialog,
  };
}

// =============================================================================
// グローバル印刷ダイアログプロバイダー
// =============================================================================

export function TemplatePrintDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const dialog = useTemplatePrintDialog();
  const { openPrintDialog } = dialog;

  useEffect(() => {
    (window as any).__openTemplatePrintDialog = (
      entityType: "patient" | "chart" | "visit" | "treatmentRecord",
      entityId: string,
      entityName?: string,
    ) => {
      openPrintDialog(entityType, entityId, entityName);
    };
    return () => {
      delete (window as any).__openTemplatePrintDialog;
    };
  }, [openPrintDialog]);

  return (
    <>
      {children}
      <TemplatePrintDialog
        isOpen={dialog.isOpen}
        onClose={dialog.closePrintDialog}
        entityType={dialog.entityType}
        entityId={dialog.entityId}
        entityName={dialog.entityName}
      />
    </>
  );
}
