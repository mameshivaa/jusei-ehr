import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { verifyAuditLogIntegrity } from "@/lib/audit";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * 監査ログの整合性検証（管理者のみ）
 *
 * ガイドライン準拠：ログの改ざん検知
 */
export async function GET(request: NextRequest) {
  let adminId: string | undefined;
  let requestedRange: {
    startDate: string | null;
    endDate: string | null;
  } | null = null;
  let limit = 10000;
  try {
    const admin = await requireRole("ADMIN");
    adminId = admin.id;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    limit = parseInt(searchParams.get("limit") || "10000", 10);
    requestedRange = { startDate, endDate };

    const result = await verifyAuditLogIntegrity({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: Math.min(limit, 50000),
    });

    // 検証操作をログに記録
    const auditData = getAuditLogData(request, admin.id, "VERIFY", "AUDIT_LOG");
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
      },
    });

    return NextResponse.json({
      success: true,
      result,
      message:
        result.invalid > 0
          ? `${result.invalid}件の監査ログに整合性問題が検出されました`
          : "全ての監査ログの整合性が確認されました",
    });
  } catch (error) {
    console.error("Audit log verification error:", error);
    const message = error instanceof Error ? error.message : "unknown";
    const isAuthError = error instanceof AuthError;
    const isForbidden =
      (isAuthError && error.code === "FORBIDDEN") || message.includes("権限");
    const isUnauthorized =
      (isAuthError && error.code === "UNAUTHENTICATED") ||
      message.includes("認証");
    const auditData = getAuditLogData(request, adminId, "VERIFY", "AUDIT_LOG");
    await createAuditLog({
      ...auditData,
      action: "VERIFY",
      entityType: "AUDIT_LOG",
      category: isForbidden || isUnauthorized ? "AUTHENTICATION" : "SYSTEM",
      severity: isForbidden || isUnauthorized ? "WARNING" : "ERROR",
      metadata: {
        success: false,
        reason: message,
        range: requestedRange,
        limit: Math.min(limit, 50000),
      },
    });
    if (isAuthError) {
      const status = isUnauthorized ? 401 : 403;
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "監査ログの検証に失敗しました" },
      { status: 500 },
    );
  }
}
