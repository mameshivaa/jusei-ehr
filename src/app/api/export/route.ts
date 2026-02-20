import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { exportToCsv } from "@/lib/data-export/csv-exporter";
import { createPasswordProtectedZip } from "@/lib/data-export/zip-encryption";
import { logFeatureAction } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/**
 * 全データエクスポートAPI
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    // 全データエクスポート
    if (type === "all") {
      const result = await exportToCsv(user.id, {
        includePatients: true,
        includeVisits: true,
        includeTreatmentRecords: true,
        minimal: false, // 全データ含める
      });

      // メタデータもJSONで含める
      const metadataFile = {
        filename: "metadata.json",
        content: JSON.stringify(result.metadata, null, 2),
      };

      // ZIPファイルを作成（暗号化なし、単純なZIP）
      const archiver = require("archiver");
      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on("data", (chunk: Buffer) => chunks.push(chunk));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", (err: Error) => reject(err));

        // CSVファイルを追加
        for (const file of result.files) {
          archive.append(Buffer.from(file.content, "utf-8"), {
            name: file.filename,
          });
        }
        // メタデータを追加
        archive.append(Buffer.from(metadataFile.content, "utf-8"), {
          name: metadataFile.filename,
        });

        archive.finalize();
      });

      await logFeatureAction("export.zip", user.id);

      return new NextResponse(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="export-${new Date().toISOString().slice(0, 10)}.zip"`,
        },
      });
    }

    // 個別タイプのエクスポート（将来用）
    return NextResponse.json(
      { error: "不明なエクスポートタイプ" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Export error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json(
        { error: "権限が不足しています" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "エクスポートに失敗しました" },
      { status: 500 },
    );
  }
}
