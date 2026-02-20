import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  extensionRegistry,
  initializeExtensions,
  getAvailableTemplates,
} from "@/lib/extensions";

export const dynamic = "force-dynamic";

/**
 * 利用可能なテンプレート一覧を取得
 *
 * クエリパラメータ:
 * - targetEntity: 対象エンティティ（patient, chart, visit, treatmentRecord）
 * - type: テンプレートの種類（print, export, report）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 初回アクセス時に拡張をロード
    if (extensionRegistry.getAll().length === 0) {
      await initializeExtensions("system");
    }

    const { searchParams } = new URL(request.url);
    const targetEntity = searchParams.get("targetEntity") as
      | "patient"
      | "chart"
      | "visit"
      | "treatmentRecord"
      | null;
    const type = searchParams.get("type") as
      | "print"
      | "export"
      | "report"
      | null;

    if (!targetEntity) {
      return NextResponse.json(
        { error: "targetEntity は必須です" },
        { status: 400 },
      );
    }

    // 利用可能なテンプレートを取得
    const templates = getAvailableTemplates(
      targetEntity,
      user.role,
      type || undefined,
    );

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Templates list error:", error);
    return NextResponse.json(
      { error: "テンプレート一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
