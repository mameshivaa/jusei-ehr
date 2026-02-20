import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import fs from "fs/promises";
import path from "path";
import { normalizeBackupFileName } from "@/lib/backup/backup-file-name";

export const dynamic = "force-dynamic";

async function resolveBackupDir(): Promise<string> {
  const configured = await getSetting("backupDirectory");
  if (!configured) {
    return path.join(process.cwd(), "backups");
  }
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

/**
 * バックアップファイルダウンロード
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");

    if (!fileName) {
      return NextResponse.json(
        { error: "fileNameが必要です" },
        { status: 400 },
      );
    }

    const safeName = normalizeBackupFileName(fileName);
    if (!safeName) {
      return NextResponse.json(
        { error: "不正なバックアップファイル名です" },
        { status: 400 },
      );
    }
    const backupDir = await resolveBackupDir();
    const filePath = path.join(backupDir, safeName);

    // ファイルの存在確認
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: "ファイルが見つかりません" },
        { status: 404 },
      );
    }

    // ファイルを読み込んで返す
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Backup download error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json(
        { error: "権限が不足しています" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "ダウンロードに失敗しました" },
      { status: 500 },
    );
  }
}
