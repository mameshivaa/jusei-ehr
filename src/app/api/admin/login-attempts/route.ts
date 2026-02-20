import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * ログイン試行履歴の取得・エクスポート（管理者のみ）
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireRole("ADMIN");

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const email = searchParams.get("email");
    const userId = searchParams.get("userId");
    const ipAddress = searchParams.get("ipAddress");
    const success = searchParams.get("success");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: any = {};
    if (email) where.email = email;
    if (userId) where.userId = userId;
    if (ipAddress) where.ipAddress = ipAddress;
    if (success !== null && success !== "") where.success = success === "true";
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const attempts = await prisma.loginAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 1000),
    });

    // エクスポート操作をログに記録
    const auditData = getAuditLogData(
      request,
      admin.id,
      "EXPORT",
      "LOGIN_ATTEMPT",
    );
    await createAuditLog({
      ...auditData,
      action: "EXPORT",
      entityType: "LOGIN_ATTEMPT",
      category: "DATA_ACCESS",
      metadata: {
        format,
        filters: { email, userId, ipAddress, success, startDate, endDate },
        recordCount: attempts.length,
      },
    });

    if (format === "csv") {
      const csvContent = generateCsv(attempts);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="login-attempts-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      attempts,
      count: attempts.length,
    });
  } catch (error) {
    console.error("Login attempts fetch error:", error);
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "ログイン試行履歴の取得に失敗しました" },
      { status: 500 },
    );
  }
}

function generateCsv(attempts: any[]): string {
  const headers = [
    "ID",
    "日時",
    "メールアドレス",
    "ユーザーID",
    "成功",
    "失敗理由",
    "MFA必要",
    "MFA成功",
    "IPアドレス",
    "ユーザーエージェント",
    "セッションID",
  ];

  const rows = attempts.map((a) => [
    a.id,
    a.createdAt.toISOString(),
    a.email,
    a.userId || "-",
    a.success ? "はい" : "いいえ",
    a.failureReason || "-",
    a.mfaRequired ? "はい" : "いいえ",
    a.mfaVerified ? "はい" : "いいえ",
    a.ipAddress || "-",
    escapeForCsv(a.userAgent || "-"),
    a.sessionId || "-",
  ]);

  const bom = "\uFEFF";
  return (
    bom +
    [
      headers.join(","),
      ...rows.map((row) => row.map((v) => escapeForCsv(String(v))).join(",")),
    ].join("\n")
  );
}

function escapeForCsv(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
