import { NextRequest, NextResponse } from "next/server";
import { getBackupSecret } from "@/lib/backup/backup-secret";
import { getBackupMissingStatus } from "@/lib/backup/backup-manager";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const normalizeBearerToken = (value: string | null): string =>
  (value || "").replace(/^Bearer\\s+/i, "").trim();

/**
 * Electronメインプロセス専用のバックアップ状態取得API
 * 認証: Authorization: Bearer <BACKUP_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = normalizeBearerToken(await getBackupSecret());

    if (!expectedSecret || expectedSecret.length < 8) {
      return NextResponse.json(
        { error: "BACKUP_SECRET が設定されていません" },
        { status: 500 },
      );
    }

    const providedSecret = normalizeBearerToken(authHeader);
    if (providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "認証失敗" }, { status: 401 });
    }

    const [lastBackupAt, missingStatus] = await Promise.all([
      getSetting("lastBackupAt"),
      getBackupMissingStatus(),
    ]);

    return NextResponse.json({
      success: true,
      lastBackupAt: lastBackupAt || "",
      missingStatus,
    });
  } catch (error) {
    console.error("Internal backup status API error:", error);
    return NextResponse.json(
      { error: "バックアップ状態の取得に失敗しました" },
      { status: 500 },
    );
  }
}
