import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { OUTCOME_LABELS } from "@/lib/injuries/injury-validation";
import { InjuryOutcome } from "@prisma/client";

export type InjuryCardData = {
  id: string;
  patientId: string;
  injuryName: string;
  injuryDate: Date | string;
  firstVisitDate: Date | string;
  endDate: Date | string | null;
  outcome: InjuryOutcome | null;
  treatmentCount: number;
  isDeleted?: boolean;
};

type Props = {
  injury: InjuryCardData;
};

export function InjuryCard({ injury }: Props) {
  const injuryDate = new Date(injury.injuryDate);
  const endDate = injury.endDate ? new Date(injury.endDate) : null;
  const outcomeLabel = injury.outcome
    ? OUTCOME_LABELS[injury.outcome as keyof typeof OUTCOME_LABELS]
    : null;

  return (
    <div
      className={`bg-white rounded-lg border p-4 ${
        injury.isDeleted
          ? "opacity-50 border-slate-300"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* タイトル行 */}
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {injury.injuryName}
            </h3>
            {injury.isDeleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                削除済み
              </span>
            )}
          </div>

          {/* 詳細行 */}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span>
              {format(injuryDate, "yyyy/MM/dd", { locale: ja })}
              {endDate ? (
                <> 〜 {format(endDate, "yyyy/MM/dd", { locale: ja })}</>
              ) : (
                <>
                  {" "}
                  〜 <span className="text-slate-400">継続中</span>
                </>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              施術{" "}
              <strong className="text-slate-900">
                {injury.treatmentCount}
              </strong>{" "}
              回
            </span>
            {outcomeLabel && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                {outcomeLabel}
              </span>
            )}
          </div>
        </div>

        {/* アクションボタン */}
      </div>
    </div>
  );
}
