import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPatientsWithoutRecentDocuments } from "@/lib/documents/document-manager";
import { getDocumentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * 未スキャン文書アラート（ガイドライン準拠：都度スキャン運用支援）
 * 最近来院したが文書がない患者のリスト
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);

    // 設定から既定値を取得（hours → days変換）
    const settings = await getDocumentSettings();
    const defaultDays = Math.ceil(settings.unscanAlertHours / 24);

    const days = parseInt(searchParams.get("days") || String(defaultDays), 10);

    const patients = await getPatientsWithoutRecentDocuments(days);

    return NextResponse.json({
      patients: patients.map((p) => ({
        id: p.id,
        name: p.name,
        patientNumber: p.patientNumber,
        lastVisit: p.visits[0]?.visitDate,
      })),
      count: patients.length,
      daysSinceVisit: days,
      settings: {
        unscanAlertHours: settings.unscanAlertHours,
        defaultDays,
      },
    });
  } catch (error) {
    console.error("Unscan alert error:", error);
    return NextResponse.json(
      { error: "未スキャンアラートの取得に失敗しました" },
      { status: 500 },
    );
  }
}
