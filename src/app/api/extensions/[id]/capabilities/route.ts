import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  grantCapabilitiesAndPersist,
  revokeCapabilitiesAndPersist,
  extensionRegistry,
} from "@/lib/extensions";
import type { ExtensionCapabilities } from "@/lib/extensions";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 拡張に権限を付与（管理者のみ）
 *
 * Body:
 * {
 *   capabilities: ExtensionCapabilities
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole("ADMIN");

    const { id } = await params;
    const extensionId = decodeURIComponent(id);

    const body = await request.json();
    const capabilities = body.capabilities as ExtensionCapabilities;

    if (!capabilities || typeof capabilities !== "object") {
      return NextResponse.json(
        { error: "権限（capabilities）を指定してください" },
        { status: 400 },
      );
    }

    // 拡張の存在確認
    const extension = extensionRegistry.get(extensionId);
    if (!extension) {
      return NextResponse.json(
        { error: `拡張 "${extensionId}" は見つかりません` },
        { status: 404 },
      );
    }

    const result = await grantCapabilitiesAndPersist(
      extensionId,
      capabilities,
      user.id,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "権限の付与に失敗しました" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      message: "権限を付与しました",
      extensionId,
      grantedCapabilities: capabilities,
    });
  } catch (error) {
    console.error("Extension grant capabilities error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "権限の付与に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * 拡張の権限を剥奪（管理者のみ）
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole("ADMIN");

    const { id } = await params;
    const extensionId = decodeURIComponent(id);

    // 拡張の存在確認
    const extension = extensionRegistry.get(extensionId);
    if (!extension) {
      return NextResponse.json(
        { error: `拡張 "${extensionId}" は見つかりません` },
        { status: 404 },
      );
    }

    const result = await revokeCapabilitiesAndPersist(extensionId, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "権限の剥奪に失敗しました" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      message: "権限を剥奪しました",
      extensionId,
    });
  } catch (error) {
    console.error("Extension revoke capabilities error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "権限の剥奪に失敗しました" },
      { status: 500 },
    );
  }
}
