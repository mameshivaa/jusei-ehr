import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSystemMode } from "@/lib/system-mode";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { getAllSettings, SECRET_SETTING_KEYS } from "@/lib/settings";
import { logFeatureAction } from "@/lib/activity-log";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// package.jsonを読み込み
const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

/**
 * システム設定ダンプ（ガイドライン準拠：設定の可視化）
 * 重要設定を一覧表示し、監査資料として利用可能
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    // システム設定を取得（秘密情報をマスク）
    const systemSettings = await getAllSettings(true); // maskSecrets = true

    // システムモードを取得
    const systemMode = await getSystemMode();

    // ロール別ユーザー数を取得
    const userCounts = await prisma.user.groupBy({
      by: ["role", "status"],
      _count: true,
    });

    // セッション集計
    const [activeSessionCount, totalSessionCount] = await Promise.all([
      prisma.userSession.count({
        where: {
          isValid: true,
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.userSession.count(),
    ]);

    // データ集計
    const [patientCount, visitCount, treatmentRecordCount, auditLogCount] =
      await Promise.all([
        prisma.patient.count({ where: { isDeleted: false } }),
        prisma.visit.count(),
        prisma.treatmentRecord.count({ where: { isDeleted: false } }),
        prisma.auditLog.count(),
      ]);

    // 設定をオブジェクトに変換（秘密情報はマスク済み）
    const settingsMap: Record<string, string> = {};
    systemSettings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    // マスクされたキーの一覧（監査用）
    const maskedKeys = SECRET_SETTING_KEYS.filter(
      (key) => settingsMap[key] === "*****",
    );

    // 環境変数から設定を取得（機密情報は除外）
    const envSettings = {
      nodeEnv: process.env.NODE_ENV || "development",
      databaseProvider: "SQLite",
      authProvider: "Local ID/Password",
      encryptionEnabled:
        !!process.env.PERSONAL_INFO_ENCRYPTION_KEY ||
        process.env.NODE_ENV === "development",
      mfaAvailable: true,
    };

    const settingsDump = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,

      // アプリケーション情報
      application: {
        name: packageJson.name,
        version: packageJson.version,
        license: packageJson.license,
      },

      // 環境設定
      environment: envSettings,

      // システムモード
      systemMode: {
        currentMode: systemMode.mode,
        reason: systemMode.reason,
        changedBy: systemMode.changedBy,
        changedAt: systemMode.changedAt,
      },

      // セキュリティ設定
      security: {
        authMethod: "Local ID/Password",
        mfaEnabled: true,
        mfaRequired: false, // 将来的に設定可能に
        sessionExpiryDays: 30,
        maxFailedLoginAttempts: 5,
        lockoutDurationMinutes: 30,
        encryptionAlgorithm: "AES-256-GCM",
        hashAlgorithm: "SHA-256",
      },

      // ロール設定
      roles: [
        { name: "ADMIN", description: "管理者：全機能にアクセス可能" },
        {
          name: "PRACTITIONER",
          description: "柔道整復師：診療記録の閲覧・作成",
        },
        { name: "RECEPTION", description: "受付：患者情報の閲覧・登録" },
      ],

      // ユーザー集計
      users: {
        byRoleAndStatus: userCounts.map((u) => ({
          role: u.role,
          status: u.status,
          count: u._count,
        })),
      },

      // セッション集計
      sessions: {
        active: activeSessionCount,
        total: totalSessionCount,
      },

      // データ集計
      data: {
        patients: patientCount,
        visits: visitCount,
        treatmentRecords: treatmentRecordCount,
        auditLogs: auditLogCount,
      },

      // カスタム設定（秘密情報はマスク済み）
      customSettings: settingsMap,

      // マスク情報（監査用）
      masking: {
        enabled: true,
        maskedKeys,
        note: "秘密情報は「*****」でマスクされています",
      },
    };

    // エクスポート操作をログに記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "EXPORT",
      "SYSTEM_SETTINGS",
    );
    await createAuditLog({
      ...auditData,
      action: "EXPORT",
      entityType: "SYSTEM_SETTINGS",
      category: "SYSTEM",
      severity: "INFO",
      metadata: {
        exportType: "settings-dump",
      },
    });

    await logFeatureAction("admin.settings.dump", user.id);

    return NextResponse.json(settingsDump);
  } catch (error) {
    console.error("Settings dump error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "設定ダンプの取得に失敗しました" },
      { status: 500 },
    );
  }
}
