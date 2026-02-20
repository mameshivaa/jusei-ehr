import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/procedures
 * 施術マスタ一覧取得
 * クエリパラメータ:
 *   - includeInactive: 非アクティブを含めるか（デフォルト: false）
 *   - search: 検索文字列（コード/名前）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "PROCEDURE_MASTER", "READ");

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const search = searchParams.get("search");

    const procedures = await prisma.procedureMaster.findMany({
      where: {
        // isActiveフィールドがあれば使用、なければ全て返す
        ...(includeInactive ? {} : {}), // TODO: isActiveフィールド追加後に有効化
        ...(search
          ? {
              OR: [
                { code: { contains: search } },
                { name: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ code: "asc" }],
    });

    return NextResponse.json(procedures);
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Procedures list error:", error);
    return NextResponse.json(
      { error: "施術マスタの取得に失敗しました" },
      { status: 500 },
    );
  }
}
