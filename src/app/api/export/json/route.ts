import { NextRequest, NextResponse } from "next/server";
import { exportToJson } from "@/lib/data-export/json-exporter";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import {
  requireExportPermission,
  shouldExportMinimalFields,
} from "@/lib/export/export-guards";
import { createPasswordProtectedZip } from "@/lib/data-export/zip-encryption";
import { logFeatureAction } from "@/lib/activity-log";
import { EXPORT_TEMPLATE_VERSIONS } from "@/lib/export/template-versions";

export async function POST(request: NextRequest) {
  let auditData: ReturnType<typeof getAuditLogData> | null = null;
  let userId: string | undefined;
  let purpose: string | undefined;
  let minimal = false;
  try {
    // エクスポート権限チェック（ADMIN + 目的入力）
    const permissionResult = await requireExportPermission(request, "DATA");
    if (permissionResult instanceof NextResponse) {
      return permissionResult;
    }
    const { user, purpose: exportPurpose } = permissionResult;
    userId = user.id;
    purpose = exportPurpose;
    auditData = getAuditLogData(request, user.id, "EXPORT", "DATA");

    const body = await request.json();
    const options = {
      includePatients: body.includePatients !== false,
      includeVisits: body.includeVisits !== false,
      includeTreatmentRecords: body.includeTreatmentRecords !== false,
      includeUsers: body.includeUsers === true,
      includeAuditLogs: body.includeAuditLogs === true,
      dateRange: body.dateRange
        ? {
            start: new Date(body.dateRange.start),
            end: new Date(body.dateRange.end),
          }
        : undefined,
    };

    minimal = shouldExportMinimalFields(request);
    const exportData = await exportToJson(user.id, {
      ...options,
      minimal,
      purpose: exportPurpose,
    });

    // パスワードが提供されている場合はZIP暗号化
    const password = body.password;
    if (password && password.length >= 8) {
      const jsonContent = JSON.stringify(exportData, null, 2);
      const zipBuffer = await createPasswordProtectedZip(
        [{ filename: "export.json", content: jsonContent }],
        password,
      );

      // 監査ログを記録
      if (auditData) {
        await createAuditLog({
          ...auditData,
          action: "EXPORT",
          entityType: "DATA",
          category: "DATA_ACCESS",
          metadata: {
            format: "JSON",
            encrypted: true,
            purpose: exportPurpose,
            minimal,
            templateVersion: EXPORT_TEMPLATE_VERSIONS.dataJson,
            dataTypes: exportData.metadata.dataTypes,
            recordCounts: exportData.metadata.recordCounts,
          },
        });
      }

      await logFeatureAction("export.json.encrypted", user.id);

      return new NextResponse(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition":
            'attachment; filename="export.json.encrypted.zip"',
        },
      });
    }

    // パスワードが提供されていない場合は通常のJSONレスポンス
    if (auditData) {
      await createAuditLog({
        ...auditData,
        action: "EXPORT",
        entityType: "DATA",
        category: "DATA_ACCESS",
        metadata: {
          format: "JSON",
          encrypted: false,
          purpose: exportPurpose,
          minimal,
          templateVersion: EXPORT_TEMPLATE_VERSIONS.dataJson,
          dataTypes: exportData.metadata.dataTypes,
          recordCounts: exportData.metadata.recordCounts,
        },
      });
    }

    await logFeatureAction("export.json", user.id);

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("JSON export error:", error);
    if (auditData && userId) {
      await createAuditLog({
        ...auditData,
        action: "EXPORT",
        entityType: "DATA",
        category: "DATA_ACCESS",
        severity: "ERROR",
        metadata: {
          format: "JSON",
          success: false,
          purpose: purpose || "",
          minimal,
          templateVersion: EXPORT_TEMPLATE_VERSIONS.dataJson,
          error: error instanceof Error ? error.message : "unknown",
        },
      });
    }
    return NextResponse.json(
      { error: "データのエクスポートに失敗しました" },
      { status: 500 },
    );
  }
}
