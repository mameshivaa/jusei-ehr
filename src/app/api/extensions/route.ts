import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  extensionRegistry,
  discoverExtensions,
  loadAllExtensions,
  initializeExtensions,
  formatCapabilitiesForDisplay,
  assessCapabilityRisk,
  getUnGrantedCapabilities,
} from "@/lib/extensions";

export const dynamic = "force-dynamic";

/**
 * 拡張一覧を取得（管理者のみ）
 *
 * レスポンス:
 * - installed: インストール済み拡張（レジストリに登録済み）
 * - discovered: ディスカバリー済み拡張（インストールされていないものも含む）
 */
export async function GET() {
  try {
    await requireRole("ADMIN");

    // 初回アクセス時に拡張をロード（レジストリが空の場合）
    if (extensionRegistry.getAll().length === 0) {
      await initializeExtensions("system");
    }

    // インストール済み拡張
    const installedExtensions = extensionRegistry.getAll();

    // ディスカバリー済み拡張
    const discoveredExtensions = await discoverExtensions();

    // 整形して返す
    const installed = installedExtensions.map((ext) => {
      const ungranted = getUnGrantedCapabilities(
        ext.manifest.capabilities,
        ext.grantedCapabilities,
      );
      const risk = assessCapabilityRisk(ext.manifest.capabilities);

      return {
        id: ext.manifest.id,
        name: ext.manifest.name,
        version: ext.manifest.version,
        publisher: ext.manifest.publisher,
        description: ext.manifest.description,
        state: ext.state,
        installedAt: ext.installedAt.toISOString(),
        enabledAt: ext.enabledAt?.toISOString(),
        path: ext.path,
        // 権限関連
        requestedCapabilities: ext.manifest.capabilities,
        grantedCapabilities: ext.grantedCapabilities,
        ungrantedCapabilities: ungranted,
        capabilitiesDisplay: formatCapabilitiesForDisplay(
          ext.manifest.capabilities,
        ),
        grantedCapabilitiesDisplay: formatCapabilitiesForDisplay(
          ext.grantedCapabilities,
        ),
        riskAssessment: risk,
        // 寄与点サマリー
        contributions: {
          commands: ext.manifest.contributes.commands?.length || 0,
          templates: ext.manifest.contributes.templates?.length || 0,
          exporters: ext.manifest.contributes.exporters?.length || 0,
          integrations: ext.manifest.contributes.integrations?.length || 0,
          views: ext.manifest.contributes.views?.length || 0,
        },
      };
    });

    const discovered = discoveredExtensions.map((ext) => ({
      path: ext.path,
      valid: ext.valid,
      manifest: ext.valid
        ? {
            id: ext.manifest?.id,
            name: ext.manifest?.name,
            version: ext.manifest?.version,
            publisher: ext.manifest?.publisher,
            description: ext.manifest?.description,
          }
        : null,
      errors: ext.errors,
    }));

    return NextResponse.json({
      installed,
      discovered,
    });
  } catch (error) {
    console.error("Extension list error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "拡張一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * 拡張を再読み込み（管理者のみ）
 *
 * extensions/ ディレクトリを再スキャンして
 * 新しい拡張をインストール
 */
export async function POST() {
  try {
    const user = await requireRole("ADMIN");

    const result = await loadAllExtensions(user.id);

    return NextResponse.json({
      message: "拡張の再読み込みが完了しました",
      loaded: result.loaded,
      failed: result.failed,
    });
  } catch (error) {
    console.error("Extension reload error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "拡張の再読み込みに失敗しました" },
      { status: 500 },
    );
  }
}
