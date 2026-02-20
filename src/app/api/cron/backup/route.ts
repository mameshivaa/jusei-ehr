import { NextRequest, NextResponse } from "next/server";
import { runAutoBackup } from "@/lib/backup/backup-manager";
import { validateCronBearerAuth } from "@/lib/cron/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 定期バックアップcron（ガイドライン準拠：バックアップ機能）
 * このエンドポイントは外部のcronサービス（例: Vercel Cron）から呼び出されます
 */
export async function GET(request: NextRequest) {
  try {
    // Cron認証（CRON_SECRET必須）
    const authResult = validateCronBearerAuth(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    );
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: authResult.status || 401 },
      );
    }

    const result = await runAutoBackup();

    if (!result.success) {
      console.error("Scheduled backup failed:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      backupPath: result.backupPath,
      deletedCount: result.deletedCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scheduled backup error:", error);
    return NextResponse.json(
      { error: "定期バックアップに失敗しました" },
      { status: 500 },
    );
  }
}
