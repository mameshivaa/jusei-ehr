import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { importLegacyBackupsToCurrentDir } from "@/lib/backup/backup-manager";

/**
 * 過去バックアップの再取り込み（手動実行）
 */
export async function POST() {
  try {
    await requireRole("ADMIN");
    const result = await importLegacyBackupsToCurrentDir();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, imported: result.imported });
  } catch (error) {
    console.error("Legacy backup import API error:", error);
    return NextResponse.json(
      { error: "過去バックアップの取り込みに失敗しました" },
      { status: 500 },
    );
  }
}
