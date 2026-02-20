import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import ExtensionsClient from "@/components/settings/ExtensionsClient";
import {
  extensionRegistry,
  discoverExtensions,
  initializeExtensions,
  formatCapabilitiesForDisplay,
  assessCapabilityRisk,
  getUnGrantedCapabilities,
} from "@/lib/extensions";

export const dynamic = "force-dynamic";

export default async function ExtensionsPage() {
  await requireRole("ADMIN");

  // 初回アクセス時に拡張をロード（レジストリが空の場合）
  if (extensionRegistry.getAll().length === 0) {
    await initializeExtensions("system");
  }

  // インストール済み拡張
  const installedExtensions = extensionRegistry.getAll();

  // ディスカバリー済み拡張
  const discoveredExtensions = await discoverExtensions();

  // 整形
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
      description: ext.manifest.description || null,
      state: ext.state,
      installedAt: ext.installedAt.toISOString(),
      enabledAt: ext.enabledAt?.toISOString() || null,
      path: ext.path,
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
    manifest:
      ext.valid && ext.manifest
        ? {
            id: ext.manifest.id,
            name: ext.manifest.name,
            version: ext.manifest.version,
            publisher: ext.manifest.publisher,
            description: ext.manifest.description || null,
          }
        : null,
    errors: ext.errors || null,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <PageHeader
          title="拡張機能管理"
          description="インストール済みの拡張を管理し、権限を付与します"
          contentOnly
        />
        <ExtensionsClient
          initialInstalled={installed}
          initialDiscovered={discovered}
        />
      </div>
    </div>
  );
}
