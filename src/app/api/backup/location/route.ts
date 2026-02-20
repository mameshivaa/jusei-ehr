import { NextResponse } from "next/server";
import { detectBackupLocation } from "@/lib/backup/location-detector";
import { getDefaultBackupDirectory } from "@/lib/backup/default-backup-dir";

export const runtime = "nodejs";

/**
 * バックアップ保存先の自動検出（初期セットアップ用）
 */
export async function GET() {
  try {
    const location = await detectBackupLocation();
    return NextResponse.json(location);
  } catch (error) {
    console.error("Backup location detect error:", error);
    return NextResponse.json(
      { directory: getDefaultBackupDirectory(), source: "default" },
      { status: 200 },
    );
  }
}
