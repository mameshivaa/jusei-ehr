import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { importFromJson } from "@/lib/data-import/json-importer";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { logFeatureAction } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    if (!body.data) {
      return NextResponse.json(
        { error: "データが指定されていません" },
        { status: 400 },
      );
    }

    const result = await importFromJson(body.data, user.id);

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
        format: "JSON",
        imported: result.imported,
        errors: result.errors,
      },
    });

    await logFeatureAction("import.json", user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("JSON import error:", error);
    return NextResponse.json(
      { error: "データのインポートに失敗しました" },
      { status: 500 },
    );
  }
}
