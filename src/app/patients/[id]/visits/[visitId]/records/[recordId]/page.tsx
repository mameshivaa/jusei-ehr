import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, History, CheckCircle2 } from "lucide-react";

export default async function TreatmentRecordDetailPage({
  params,
}: {
  params: { id: string; visitId: string; recordId: string };
}) {
  await requireAuth();

  const record = await prisma.treatmentRecord.findUnique({
    where: { id: params.recordId, isDeleted: false },
    include: {
      visit: {
        include: {
          patient: true,
        },
      },
      updatedByUser: {
        select: { name: true, email: true },
      },
      confirmedByUser: {
        select: { name: true, email: true },
      },
      history: {
        orderBy: { changedAt: "desc" },
        include: {
          changedByUser: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  if (!record) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href={`/patients/${params.id}/visits/${params.visitId}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            来院記録に戻る
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                施術記録詳細 - {record.visit.patient.name}
              </h1>
              <p className="text-slate-600 mt-1">
                作成日時:{" "}
                {format(new Date(record.createdAt), "yyyy年MM月dd日 HH:mm", {
                  locale: ja,
                })}
                {record.updatedAt.getTime() !== record.createdAt.getTime() && (
                  <>
                    {" "}
                    / 更新日時:{" "}
                    {format(
                      new Date(record.updatedAt),
                      "yyyy年MM月dd日 HH:mm",
                      { locale: ja },
                    )}
                  </>
                )}
              </p>
            </div>
            {record.isConfirmed && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">確定済み</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* 施術記録内容 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">記録内容</h2>
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-1">内容</h4>
              <p className="text-slate-900 whitespace-pre-wrap">
                {record.narrative || "内容なし"}
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">作成者:</span>
                  <span className="ml-2 text-slate-900">
                    {record.updatedByUser?.name || "不明"}
                  </span>
                </div>
                {record.isConfirmed && record.confirmedByUser && (
                  <div>
                    <span className="text-slate-600">確定者:</span>
                    <span className="ml-2 text-slate-900">
                      {record.confirmedByUser.name}
                    </span>
                    {record.confirmedAt && (
                      <span className="ml-2 text-slate-600">
                        (
                        {format(
                          new Date(record.confirmedAt),
                          "yyyy年MM月dd日 HH:mm",
                          { locale: ja },
                        )}
                        )
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 更新履歴 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">更新履歴</h2>
            </div>
            {record.history.length === 0 ? (
              <p className="text-slate-600">更新履歴はありません</p>
            ) : (
              <div className="space-y-4">
                {record.history.map((history) => (
                  <div
                    key={history.id}
                    className="border-l-4 border-slate-300 pl-4 py-2"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-slate-900">
                          {history.changedByUser?.name || "不明"}
                        </span>
                        <span className="ml-2 text-sm text-slate-600">
                          {format(
                            new Date(history.changedAt),
                            "yyyy年MM月dd日 HH:mm",
                            { locale: ja },
                          )}
                        </span>
                      </div>
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700">
                        {history.changeType === "CREATE" && "作成"}
                        {history.changeType === "UPDATE" && "更新"}
                        {history.changeType === "DELETE" && "削除"}
                        {history.changeType === "CONFIRM" && "確定"}
                      </span>
                    </div>
                    {history.changeReason && (
                      <p className="text-sm text-slate-600 mb-2">
                        理由: {history.changeReason}
                      </p>
                    )}
                    <div className="text-sm text-slate-600">
                      <p>バージョン: {history.version}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
