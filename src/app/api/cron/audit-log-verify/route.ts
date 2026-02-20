import { NextRequest, NextResponse } from "next/server";
import {
  createAuditLog,
  getAuditLogData,
  verifyAuditLogIntegrity,
} from "@/lib/audit";
import { validateCronBearerAuth } from "@/lib/cron/auth";

export const dynamic = "force-dynamic";

/**
 * 定期実行用: 監査ログの整合性検証
 * - CRON_SECRET 必須
 * - Authorization: Bearer <secret> を要求
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = validateCronBearerAuth(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    );
    if (!authResult.ok) {
      const auditData = getAuditLogData(
        request,
        undefined,
        "VERIFY",
        "AUDIT_LOG",
      );
      await createAuditLog({
        ...auditData,
        action: "VERIFY",
        entityType: "AUDIT_LOG",
        category: "AUTHENTICATION",
        severity: "WARNING",
        metadata: {
          success: false,
          reason:
            authResult.status === 503
              ? "CRON_SECRET_MISSING"
              : "CRON_SECRET_INVALID",
        },
      });
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: authResult.status || 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "10000", 10);

    const result = await verifyAuditLogIntegrity({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: Math.min(limit, 50000),
    });

    const auditData = getAuditLogData(
      request,
      undefined,
      "VERIFY",
      "AUDIT_LOG",
    );
    await createAuditLog({
      ...auditData,
      action: "VERIFY",
      entityType: "AUDIT_LOG",
      category: "SYSTEM",
      severity: result.invalid > 0 ? "WARNING" : "INFO",
      metadata: {
        total: result.total,
        valid: result.valid,
        invalid: result.invalid,
        startDate: startDate || null,
        endDate: endDate || null,
        limit: Math.min(limit, 50000),
      },
    });

    return NextResponse.json({
      ok: true,
      result,
      message:
        result.invalid > 0
          ? `${result.invalid}件の監査ログに整合性問題が検出されました`
          : "全ての監査ログの整合性が確認されました",
    });
  } catch (error) {
    console.error("Cron audit log verify error:", error);
    const message = error instanceof Error ? error.message : "unknown";
    const auditData = getAuditLogData(
      request,
      undefined,
      "VERIFY",
      "AUDIT_LOG",
    );
    await createAuditLog({
      ...auditData,
      action: "VERIFY",
      entityType: "AUDIT_LOG",
      category: "SYSTEM",
      severity: "ERROR",
      metadata: {
        success: false,
        reason: message,
      },
    });
    return NextResponse.json({ error: "verify failed" }, { status: 500 });
  }
}
