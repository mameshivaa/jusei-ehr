import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

const docMap: Record<string, string> = {
  "docs-index": "docs/README.md",
  "current-master-index": "docs/current/MASTER_INDEX.md",
  "current-overview": "docs/current/OVERVIEW.md",
  "current-architecture": "docs/current/ARCHITECTURE.md",
  "current-data-model": "docs/current/DATA_MODEL.md",
  "current-api-surface": "docs/current/API_SURFACE.md",
  "current-extensibility": "docs/current/EXTENSIBILITY.md",
  "current-operations": "docs/current/OPERATIONS.md",
  "current-user-operation-guide": "docs/current/USER_OPERATION_GUIDE.md",
  "current-backup-and-recovery": "docs/current/BACKUP_AND_RECOVERY.md",
  "current-deployment-baseline": "docs/current/DEPLOYMENT_BASELINE.md",
  "current-security-baseline": "docs/current/SECURITY_BASELINE.md",
  "current-incident-response-playbook":
    "docs/current/INCIDENT_RESPONSE_PLAYBOOK.md",
  "current-document-control-policy": "docs/current/DOCUMENT_CONTROL_POLICY.md",
  "current-document-template-standard":
    "docs/current/DOCUMENT_TEMPLATE_STANDARD.md",
  "current-traceability-matrix": "docs/current/TRACEABILITY_MATRIX.md",
  "current-outsourced-maintenance-model":
    "docs/current/OUTSOURCED_MAINTENANCE_MODEL.md",
  "current-extension-platform": "docs/current/EXTENSION_PLATFORM.md",
  "current-electron-release-operations":
    "docs/current/ELECTRON_RELEASE_OPERATIONS.md",
  "current-audit-readiness": "docs/current/AUDIT_READINESS.md",
  "current-raci": "docs/current/RACI.md",
  "current-change-and-release-control":
    "docs/current/CHANGE_AND_RELEASE_CONTROL.md",
  "current-quality-assurance-gates": "docs/current/QUALITY_ASSURANCE_GATES.md",
  "current-vendor-handover-checklist":
    "docs/current/VENDOR_HANDOVER_CHECKLIST.md",
  "current-document-register": "docs/current/DOCUMENT_REGISTER.md",
  "current-doc-migration-status": "docs/current/DOC_MIGRATION_STATUS.md",
  // 旧slug互換（Currentへ転送）
  "system-specification": "docs/current/MASTER_INDEX.md",
  "system-architecture": "docs/current/ARCHITECTURE.md",
  "system-stakeholders": "docs/current/RACI.md",
  "operations-manual": "docs/current/OPERATIONS.md",
  "emergency-procedures": "docs/current/INCIDENT_RESPONSE_PLAYBOOK.md",
  "security-incident-response": "docs/current/INCIDENT_RESPONSE_PLAYBOOK.md",
  "user-guide": "docs/current/USER_OPERATION_GUIDE.md",
  "responsibility-demarcation": "docs/current/OUTSOURCED_MAINTENANCE_MODEL.md",
  "service-specification-disclosure": "docs/current/DOCUMENT_CONTROL_POLICY.md",
  "client-security": "docs/current/SECURITY_BASELINE.md",
  "server-security": "docs/current/SECURITY_BASELINE.md",
  "infrastructure-security": "docs/current/SECURITY_BASELINE.md",
  "security-measures": "docs/current/SECURITY_BASELINE.md",
  "backup-system": "docs/current/BACKUP_AND_RECOVERY.md",
  "extension-system": "docs/current/EXTENSION_PLATFORM.md",
  "audit-readiness-kit": "docs/current/AUDIT_READINESS.md",
  "deployment-checklist-oss": "docs/current/DEPLOYMENT_BASELINE.md",
  "electron-guide": "docs/current/ELECTRON_RELEASE_OPERATIONS.md",
};

export default async function DocCategoryPage({
  params,
}: {
  params: { category: string };
}) {
  // セットアップチェック
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    redirect("/setup");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const docPath = docMap[params.category];
  if (!docPath) {
    notFound();
  }

  // Markdownファイルを読み込む
  const filePath = path.join(process.cwd(), docPath);
  let content = "";

  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    notFound();
  }

  // MarkdownをHTMLに変換（簡易版）
  // 本番環境では、remarkやmarkedなどのライブラリを使用することを推奨
  let htmlContent = content
    // コードブロックを保護
    .replace(/```[\s\S]*?```/g, (match) => {
      return `<pre class="bg-slate-100 p-4 rounded-lg overflow-x-auto my-4"><code>${match.replace(/```[\w]*\n?/g, "").replace(/```/g, "")}</code></pre>`;
    })
    // インラインコード
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 rounded">$1</code>')
    // 見出し
    .replace(
      /^### (.*$)/gim,
      '<h3 class="text-xl font-semibold text-slate-900 mt-6 mb-3">$1</h3>',
    )
    .replace(
      /^## (.*$)/gim,
      '<h2 class="text-2xl font-semibold text-slate-900 mt-8 mb-4">$1</h2>',
    )
    .replace(
      /^# (.*$)/gim,
      '<h1 class="text-3xl font-bold text-slate-900 mt-8 mb-6">$1</h1>',
    )
    // 太字
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // リスト
    .replace(/^\- (.*$)/gim, '<li class="ml-6 list-disc">$1</li>')
    // 段落
    .split("\n\n")
    .map((para) => {
      if (para.trim().startsWith("<")) return para;
      return `<p class="mb-4 text-slate-700 leading-relaxed">${para.trim().replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            文書一覧に戻る
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-8">
          <article
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    </main>
  );
}
