import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { importPatientsFromCsv } from "@/lib/data-import/csv-importer";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { logFeatureAction } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    if (!body.csvContent) {
      return NextResponse.json(
        { error: "CSVコンテンツが指定されていません" },
        { status: 400 },
      );
    }

    const result = await importPatientsFromCsv(body.csvContent, user.id);

    // 監査ログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "IMPORT",
      "DATA",
      undefined,
    );
    await createAuditLog({
      ...auditData,
      action: "IMPORT",
      entityType: "DATA",
      category: "DATA_MODIFICATION",
      metadata: {
        format: "CSV",
        imported: result.imported,
        errors: result.errors,
      },
    });

    await logFeatureAction("import.csv", user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      { error: "データのインポートに失敗しました" },
      { status: 500 },
    );
  }
}
