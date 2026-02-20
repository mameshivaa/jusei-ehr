import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  extensionRegistry,
  formatCapabilitiesForDisplay,
  assessCapabilityRisk,
  getUnGrantedCapabilities,
} from "@/lib/extensions";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 拡張詳細を取得（管理者のみ）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole("ADMIN");

    const { id } = await params;
    const extensionId = decodeURIComponent(id);

    const extension = extensionRegistry.get(extensionId);
    if (!extension) {
      return NextResponse.json(
        { error: `拡張 "${extensionId}" は見つかりません` },
        { status: 404 },
      );
    }

    const ungranted = getUnGrantedCapabilities(
      extension.manifest.capabilities,
      extension.grantedCapabilities,
    );
    const risk = assessCapabilityRisk(extension.manifest.capabilities);

    return NextResponse.json({
      id: extension.manifest.id,
      name: extension.manifest.name,
      version: extension.manifest.version,
      minAppVersion: extension.manifest.minAppVersion,
      publisher: extension.manifest.publisher,
      description: extension.manifest.description,
      license: extension.manifest.license,
      repository: extension.manifest.repository,
      state: extension.state,
      installedAt: extension.installedAt.toISOString(),
      enabledAt: extension.enabledAt?.toISOString(),
      path: extension.path,
      errorMessage: extension.errorMessage,
      // 権限関連
      requestedCapabilities: extension.manifest.capabilities,
      grantedCapabilities: extension.grantedCapabilities,
      ungrantedCapabilities: ungranted,
      capabilitiesDisplay: formatCapabilitiesForDisplay(
        extension.manifest.capabilities,
      ),
      grantedCapabilitiesDisplay: formatCapabilitiesForDisplay(
        extension.grantedCapabilities,
      ),
      ungrantedCapabilitiesDisplay: formatCapabilitiesForDisplay(ungranted),
      riskAssessment: risk,
      // 寄与点詳細
      contributions: extension.manifest.contributes,
    });
  } catch (error) {
    console.error("Extension detail error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "拡張詳細の取得に失敗しました" },
      { status: 500 },
    );
  }
}
