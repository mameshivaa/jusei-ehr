"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Trash2, AlertCircle, Lock } from "lucide-react";
import { InjurySelect } from "@/components/injuries/InjurySelect";
import { ProcedureSelect } from "./ProcedureSelect";
import { useSystemMode } from "@/components/providers/SystemModeProvider";
import { TemplatePanel } from "@/components/records/TemplatePanel";
import { useUser } from "@/hooks/useUser";
import { useDraftTracking } from "@/hooks/useDraftTracking";

type TreatmentDetail = {
  id?: string;
  procedureId: string;
  procedureName?: string;
  bodyPart: string | null;
  quantity: number;
  unitPrice: number | null;
};

type TreatmentRecord = {
  id: string;
  narrative: string | null;
  version: number;
  injuryId: string | null;
  treatmentDetails?: TreatmentDetail[];
};

type Props = {
  record?: TreatmentRecord;
  visitId: string;
  patientId: string;
  isLegacyData?: boolean; // 既存データの場合はinjuryIdをnull許容
};

export function TreatmentRecordForm({
  record,
  visitId,
  patientId,
  isLegacyData = false,
}: Props) {
  const router = useRouter();
  const { isReadOnly } = useSystemMode();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [injuryId, setInjuryId] = useState<string | null>(
    record?.injuryId || null,
  );
  const [narrative, setNarrative] = useState(record?.narrative || "");
  const [changeReason, setChangeReason] = useState(record ? "内容更新" : "");
  const [treatmentDetails, setTreatmentDetails] = useState<TreatmentDetail[]>(
    record?.treatmentDetails || [],
  );

  const { notifyActivity, markDirty, markCommit, markReopen } =
    useDraftTracking({
      entityType: "record",
      entityId: record?.id ?? null,
      actorId: user?.id ?? null,
      enabled: !!user?.id,
    });

  // デバッグ用：userとrecordの状態を確認
  useEffect(() => {
    console.log("[TreatmentRecordForm] user:", user);
    console.log("[TreatmentRecordForm] record?.id:", record?.id);
    console.log("[TreatmentRecordForm] enabled:", !!user?.id);
  }, [user, record?.id]);

  // 既存施術記録の再編集開始を記録
  useEffect(() => {
    if (!record?.id || !user?.id) return;
    void markReopen();
  }, [markReopen, record?.id, user?.id]);

  // 施術明細を追加
  const addTreatmentDetail = () => {
    notifyActivity();
    setTreatmentDetails([
      ...treatmentDetails,
      { procedureId: "", bodyPart: null, quantity: 1, unitPrice: null },
    ]);
  };

  // 施術明細を削除
  const removeTreatmentDetail = (index: number) => {
    notifyActivity();
    setTreatmentDetails(treatmentDetails.filter((_, i) => i !== index));
  };

  // 施術明細を更新
  const updateTreatmentDetail = (
    index: number,
    updates: Partial<TreatmentDetail>,
  ) => {
    notifyActivity();
    setTreatmentDetails(
      treatmentDetails.map((detail, i) =>
        i === index ? { ...detail, ...updates } : detail,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    markDirty();

    // 新規作成時はinjuryIdが必須（isLegacyDataでない限り）
    if (!record && !injuryId && !isLegacyData) {
      setError("負傷エピソードを選択してください");
      return;
    }

    // 訂正理由は既存記録の更新時に必須
    if (record && (!changeReason || changeReason.trim().length === 0)) {
      setError("訂正理由を入力してください");
      return;
    }

    // 施術明細のバリデーション
    const validDetails = treatmentDetails.filter((d) => d.procedureId);
    if (
      treatmentDetails.length > 0 &&
      validDetails.length !== treatmentDetails.length
    ) {
      setError("施術明細の施術を選択してください");
      return;
    }

    setLoading(true);

    const data = {
      narrative: narrative || null,
      version: record?.version || 1,
      injuryId,
      treatmentDetails: validDetails.map((d) => ({
        procedureId: d.procedureId,
        bodyPart: d.bodyPart,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
      })),
      isLegacyData,
      changeReason: record ? changeReason.trim() : undefined,
    };

    try {
      const url = record
        ? `/api/treatment-records/${record.id}`
        : `/api/treatment-records?visitId=${visitId}`;
      const method = record ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }

      await markCommit();

      router.back();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 既存データでinjuryIdがnullの場合の警告表示
  const showUnlinkedWarning = record && !record.injuryId && !injuryId;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 読み取り専用モード警告 */}
      {isReadOnly && (
        <div className="p-3 bg-slate-100 border border-slate-300 rounded text-slate-700 text-sm flex items-center gap-2">
          <Lock className="h-4 w-4" />
          システムは現在読み取り専用モードです。変更を保存できません。
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {showUnlinkedWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            この施術記録は負傷エピソードに紐付けられていません。
            編集時に負傷エピソードを選択することを推奨します。
          </span>
        </div>
      )}

      <div className="space-y-4">
        {/* 負傷エピソード選択 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            負傷エピソード{" "}
            {!record && !isLegacyData && (
              <span className="text-red-500">*</span>
            )}
          </label>
          <InjurySelect
            patientId={patientId}
            value={injuryId}
            onChange={(v) => {
              notifyActivity();
              setInjuryId(v);
            }}
            required={!record && !isLegacyData}
            showUnlinkedOption={record !== undefined || isLegacyData}
          />
          {isLegacyData && (
            <p className="mt-1 text-xs text-slate-500">
              既存データのため、負傷エピソードの選択は任意です
            </p>
          )}
        </div>

        {/* テンプレートパネル */}
        <TemplatePanel
          onApply={(t) => {
            notifyActivity();
            setNarrative(t.narrative || "");
          }}
          getCurrentValues={() => ({
            narrative,
          })}
        />

        <div>
          <label
            htmlFor="narrative"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            記録内容
          </label>
          <textarea
            rows={4}
            value={narrative}
            onChange={(e) => {
              notifyActivity();
              setNarrative(e.target.value);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="施術内容や経過、注意事項などを記入してください"
          />
        </div>

        {/* 施術明細 */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700">
              施術明細
            </label>
            {!isReadOnly && (
              <button
                type="button"
                onClick={addTreatmentDetail}
                className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
              >
                <Plus className="h-4 w-4" />
                追加
              </button>
            )}
          </div>

          {treatmentDetails.length === 0 ? (
            <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-md text-center">
              施術明細がありません。「追加」ボタンで追加できます。
            </p>
          ) : (
            <div className="space-y-3">
              {treatmentDetails.map((detail, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-md"
                >
                  <div className="col-span-5">
                    <label className="block text-xs text-slate-500 mb-1">
                      施術
                    </label>
                    <ProcedureSelect
                      value={detail.procedureId}
                      onChange={(id) =>
                        updateTreatmentDetail(index, { procedureId: id })
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs text-slate-500 mb-1">
                      部位
                    </label>
                    <input
                      type="text"
                      value={detail.bodyPart || ""}
                      onChange={(e) =>
                        updateTreatmentDetail(index, {
                          bodyPart: e.target.value || null,
                        })
                      }
                      placeholder="例: 腰部"
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">
                      数量
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={detail.quantity}
                      onChange={(e) =>
                        updateTreatmentDetail(index, {
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeTreatmentDetail(index)}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 訂正理由（編集時のみ表示） */}
      {record && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            訂正理由 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={changeReason}
            onChange={(e) => {
              notifyActivity();
              setChangeReason(e.target.value);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
            placeholder="例: 誤記訂正、追加情報反映、指示変更 など"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            電子カルテガイドラインに基づき、訂正理由の記録が必要です。
          </p>
        </div>
      )}

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
        >
          キャンセル
        </button>
        {!isReadOnly && (
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "保存中..." : "保存"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        )}
      </div>
    </form>
  );
}
