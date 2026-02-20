import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLicenseCache } from "@/lib/extensions/marketplace/license-enforcer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const licenses = await getLicenseCache();
    return NextResponse.json({ licenses });
  } catch (error) {
    console.error("Marketplace licenses error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "ライセンス一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}
