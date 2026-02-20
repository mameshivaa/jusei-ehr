import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchCatalog } from "@/lib/extensions/marketplace/marketplace-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const catalog = await fetchCatalog();
    return NextResponse.json({ catalog });
  } catch (error) {
    console.error("Marketplace catalog error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "カタログの取得に失敗しました" },
      { status: 500 },
    );
  }
}
