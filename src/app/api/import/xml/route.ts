import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { importFromXml } from "@/lib/data-import/xml-importer";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { logFeatureAction } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    if (!body.xmlContent) {
      return NextResponse.json(
        { error: "XMLコンテンツが指定されていません" },
        { status: 400 },
      );
    }

    const result = await importFromXml(body.xmlContent, user.id);

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
        format: "XML",
        imported: result.imported,
        errors: result.errors,
      },
    });

    await logFeatureAction("import.xml", user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("XML import error:", error);
    return NextResponse.json(
      { error: "データのインポートに失敗しました" },
      { status: 500 },
    );
  }
}
