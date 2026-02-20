import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSystemMode } from "@/lib/system-mode";
import fs from "fs";
import path from "path";

// package.jsonを読み込み
const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

/**
 * システム情報API（ガイドライン準拠：バージョン・構成情報）
 */
export async function GET() {
  try {
    await requireAuth();

    const systemMode = await getSystemMode();

    const systemInfo = {
      // アプリケーション情報
      app: {
        name: packageJson.name,
        version: packageJson.version,
        description: "無料配布版 接骨院向け電子カルテシステム（ソース非公開）",
      },

      // ランタイム情報
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },

      // フレームワーク・依存関係のバージョン
      dependencies: {
        next: packageJson.dependencies.next,
        react: packageJson.dependencies.react,
        prisma: packageJson.dependencies["@prisma/client"],
        supabase: packageJson.dependencies["@supabase/supabase-js"],
      },

      // データベース情報
      database: {
        provider: "SQLite",
        // マイグレーション情報は別途取得が必要
      },

      // システムモード
      systemMode: {
        mode: systemMode.mode,
        reason: systemMode.reason,
      },

      // 機能フラグ
      features: {
        mfaSupported: true,
        encryptionEnabled: true,
        auditLogging: true,
        proxyOperations: true,
        dataExport: true,
        dataImport: true,
        backup: true,
      },

      // タイムスタンプ
      serverTime: new Date().toISOString(),
    };

    return NextResponse.json(systemInfo);
  } catch (error) {
    console.error("System info error:", error);
    return NextResponse.json(
      { error: "システム情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
