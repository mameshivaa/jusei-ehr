import { prisma } from "@/lib/prisma";
import { format, startOfDay, subDays } from "date-fns";
import { Bell, Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { AuthError, requireAuth } from "@/lib/auth";
import PageHeader from "@/components/layout/PageHeader";
import { UpdateNotice } from "@/components/home/UpdateNotice";

export default async function HomePage() {
  try {
    await requireAuth();
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
      redirect("/auth/signin");
    }
    throw error;
  }

  // today-based counts
  const today = startOfDay(new Date());
  const weekAgo = subDays(today, 7);

  const [
    patientCount,
    chartCount,
    todayVisitCount,
    todayRecordCount,
    recentPatients,
    recentRecords,
  ] = await Promise.all([
    prisma.patient.count({ where: { isDeleted: false } }),
    prisma.chart.count(),
    prisma.visit.count({ where: { visitDate: { gte: today } } }),
    prisma.treatmentRecord.count({
      where: { createdAt: { gte: today }, isDeleted: false },
    }),
    // 最近更新された患者（最大3件）
    prisma.patient.findMany({
      where: { isDeleted: false, updatedAt: { gte: weekAgo } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, name: true, updatedAt: true },
    }),
    // 最近の施術録（最大3件）
    prisma.treatmentRecord.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        createdAt: true,
        visit: {
          select: {
            patient: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const todayLabel = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date());

  return (
    <div className="p-4 md:p-5 lg:p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-baseline justify-between pb-2">
        <PageHeader
          title="ホーム"
          subtitle="よく使う登録アクションに素早く移動できます"
        />
        <div className="text-right">
          <div className="text-xs text-slate-500 mb-0.5">今日</div>
          <div className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
            {todayLabel}
          </div>
        </div>
      </div>

      {/* サマリーカード */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="患者数" value={patientCount} />
          <StatCard label="カルテ数" value={chartCount} />
          <StatCard label="今日の受付" value={todayVisitCount} />
          <StatCard label="今日の施術録" value={todayRecordCount} />
        </div>
      </section>

      {/* 通知と最近のアクティビティ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* 通知 */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 tracking-tight">
              お知らせ
            </span>
          </div>
          <div className="space-y-2.5">
            <UpdateNotice />
          </div>
        </div>

        {/* 最近のアクティビティ */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 tracking-tight">
              最近のアクティビティ
            </span>
          </div>
          <div className="space-y-2">
            {recentRecords.length > 0 ? (
              recentRecords.map((record) => (
                <ActivityItem
                  key={record.id}
                  text={`${record.visit.patient.name} の施術録`}
                  time={format(record.createdAt, "M/d HH:mm")}
                />
              ))
            ) : recentPatients.length > 0 ? (
              recentPatients.map((patient) => (
                <ActivityItem
                  key={patient.id}
                  text={`${patient.name} を更新`}
                  time={format(patient.updatedAt, "M/d HH:mm")}
                />
              ))
            ) : (
              <div className="text-sm text-slate-400 py-2">
                最近のアクティビティはありません
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-4 py-3 md:px-4 md:py-4 border border-slate-100">
      <div className="text-xs text-slate-500 mb-1.5 font-medium">{label}</div>
      <div className="text-2xl md:text-3xl font-semibold text-slate-800 tracking-tight">
        {value}
      </div>
    </div>
  );
}

function ActivityItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-sm text-slate-600 truncate leading-relaxed">
        {text}
      </span>
      <span className="text-xs text-slate-400 flex-shrink-0 font-medium tabular-nums">
        {time}
      </span>
    </div>
  );
}
