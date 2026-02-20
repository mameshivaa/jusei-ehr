"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CheckCircle, Lock } from "lucide-react";
import { useState } from "react";

type TreatmentRecord = {
  id: string;
  narrative: string | null;
  createdAt: Date;
  updatedAt: Date;
  isConfirmed: boolean;
  confirmedAt: Date | null;
  digitalSignature: string | null;
  updatedByUser: {
    name: string;
  };
};

export function TreatmentRecordList({
  records,
  visitId,
  patientId,
}: {
  records: TreatmentRecord[];
  visitId: string;
  patientId: string;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleConfirm = async (recordId: string) => {
    const changeReason = window.prompt(
      "確定理由を入力してください（必須）",
      "記録を確定",
    );
    if (!changeReason || changeReason.trim().length === 0) {
      return;
    }
    setConfirming(recordId);
    try {
      const response = await fetch(
        `/api/treatment-records/${recordId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changeReason: changeReason.trim() }),
        },
      );
      if (response.ok) {
        window.location.reload();
      } else {
        alert("確定に失敗しました");
      }
    } catch (error) {
      alert("確定に失敗しました");
    } finally {
      setConfirming(null);
    }
  };

  if (records.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-600">施術記録がありません</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {records.map((record) => (
        <div key={record.id} className="p-6 hover:bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  施術記録
                </h3>
                {record.isConfirmed && (
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>確定済み</span>
                    {record.digitalSignature && (
                      <div className="flex items-center gap-1 text-slate-600 ml-2">
                        <Lock className="h-3 w-3" />
                        <span>電子署名済み</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600">
                {format(new Date(record.createdAt), "yyyy年MM月dd日 HH:mm", {
                  locale: ja,
                })}{" "}
                -{record.updatedByUser.name}
                {record.confirmedAt && (
                  <span className="ml-2">
                    （確定:{" "}
                    {format(new Date(record.confirmedAt), "yyyy/MM/dd HH:mm", {
                      locale: ja,
                    })}
                    ）
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!record.isConfirmed && (
                <button
                  onClick={() => handleConfirm(record.id)}
                  disabled={confirming === record.id}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {confirming === record.id ? "確定中..." : "確定"}
                </button>
              )}
              <Link
                href={`/patients/${patientId}/visits/${visitId}/records/${record.id}`}
                className="text-slate-600 hover:text-slate-900 text-sm"
              >
                詳細
              </Link>
              {!record.isConfirmed && (
                <Link
                  href={`/patients/${patientId}/visits/${visitId}/records/${record.id}/edit`}
                  className="text-slate-600 hover:text-slate-900 text-sm"
                >
                  編集
                </Link>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-1">内容</h4>
            <p className="text-slate-900 whitespace-pre-wrap">
              {record.narrative || "内容なし"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
