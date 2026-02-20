import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { disableExtensionAndPersist } from "@/lib/extensions";
import { logFeatureAction } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 拡張を無効化（管理者のみ）
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole("ADMIN");

    const { id } = await params;
    const extensionId = decodeURIComponent(id);

    const result = await disableExtensionAndPersist(extensionId, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "拡張の無効化に失敗しました" },
        { status: 400 },
      );
    }

    await logFeatureAction("extension.disable", user.id);

    return NextResponse.json({
      message: "拡張を無効化しました",
      extensionId,
    });
  } catch (error) {
    console.error("Extension disable error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "拡張の無効化に失敗しました" },
      { status: 500 },
    );
  }
}
