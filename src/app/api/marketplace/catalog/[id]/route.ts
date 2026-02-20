import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchCatalogItem } from "@/lib/extensions/marketplace/marketplace-client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAuth();
    const item = await fetchCatalogItem(params.id);
    return NextResponse.json({ item });
  } catch (error) {
    console.error("Marketplace catalog detail error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "拡張詳細の取得に失敗しました" },
      { status: 500 },
    );
  }
}
