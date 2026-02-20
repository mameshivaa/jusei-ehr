import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

const SETTING_KEYS = [
  "pdfPreviewIncludeOutputTimestamp",
  "pdfPreviewIncludePatientName",
  "pdfPreviewIncludePatientId",
  "pdfPreviewIncludeInsurance",
  "pdfPreviewIncludeStatus",
  "pdfPreviewIncludeFirstVisitDate",
  "pdfPreviewIncludeRecordHeaderDate",
  "pdfPreviewIncludeRecordHeaderMilestone",
  "pdfPreviewIncludeRecordHeaderUpdatedAt",
  "pdfPreviewIncludeRecordHeaderAuthor",
  "pdfPreviewIncludeRecordContent",
  "pdfPreviewIncludeRecordHistory",
  "pdfPreviewIncludeRecordInjury",
  "pdfPreviewIncludeRecordInjuryDate",
  "pdfPreviewIncludeTreatmentDetails",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

export async function GET(request: NextRequest) {
  let userId: string | undefined;
  try {
    const user = await requireRole("ADMIN");
    userId = user.id;
    const settings = await getSettings([...SETTING_KEYS]);
    const auditData = getAuditLogData(
      request,
      userId,
      "READ",
      "SYSTEM_SETTING",
    );
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "SYSTEM_SETTING",
      category: "DATA_ACCESS",
      metadata: {
        view: "PDF_PREVIEW_SETTINGS",
        keyCount: SETTING_KEYS.length,
      },
    });
    return NextResponse.json(settings);
  } catch (error) {
    const auditData = getAuditLogData(
      request,
      userId,
      "READ",
      "SYSTEM_SETTING",
    );
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "SYSTEM_SETTING",
      category: "SYSTEM",
      severity: "ERROR",
      metadata: {
        success: false,
        view: "PDF_PREVIEW_SETTINGS",
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "PDFプレビュー設定の取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  let userId: string | undefined;
  try {
    const user = await requireRole("ADMIN");
    userId = user.id;
    const body = await request.json().catch(() => ({}));

    const updates: Array<[SettingKey, string]> = [];
    for (const key of SETTING_KEYS) {
      if (typeof body[key] === "boolean") {
        updates.push([key, body[key] ? "true" : "false"]);
      }
    }

    for (const [key, value] of updates) {
      await setSetting(key, value, user.id);
    }

    const settings = await getSettings([...SETTING_KEYS]);
    const auditData = getAuditLogData(
      request,
      userId,
      "UPDATE",
      "SYSTEM_SETTING",
    );
    await createAuditLog({
      ...auditData,
      action: "UPDATE",
      entityType: "SYSTEM_SETTING",
      category: "DATA_MODIFICATION",
      metadata: {
        view: "PDF_PREVIEW_SETTINGS",
        changedKeys: updates.map(([key]) => key),
        changedCount: updates.length,
      },
    });
    return NextResponse.json(settings);
  } catch (error) {
    const auditData = getAuditLogData(
      request,
      userId,
      "UPDATE",
      "SYSTEM_SETTING",
    );
    await createAuditLog({
      ...auditData,
      action: "UPDATE",
      entityType: "SYSTEM_SETTING",
      category: "SYSTEM",
      severity: "ERROR",
      metadata: {
        success: false,
        view: "PDF_PREVIEW_SETTINGS",
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "PDFプレビュー設定の更新に失敗しました" },
      { status: 500 },
    );
  }
}
