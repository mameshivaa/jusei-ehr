import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  FileText,
  BookOpen,
  AlertTriangle,
  Shield,
  Settings,
  Users,
  Network,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isDevBypassAuthEnabled } from "@/lib/security/dev-bypass";
export const dynamic = "force-dynamic";

export default async function DocsPage() {
  // セットアップチェック
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    redirect("/setup");
  }

  const user = await getCurrentUser();

  // 開発環境で認証をスキップする場合はスキップ
  if (!isDevBypassAuthEnabled() && !user) {
    redirect("/auth/signin");
  }

  const docs = [
    {
      category: "Current Core",
      items: [
        {
          title: "Documentation Index",
          description: "Current 文書の運用方針と参照先",
          href: "/docs/docs-index",
          icon: BookOpen,
          color: "green",
        },
        {
          title: "Master Index",
          description: "Current文書の統合索引",
          href: "/docs/current-master-index",
          icon: BookOpen,
          color: "green",
        },
        {
          title: "Overview",
          description: "現在の実装構成の要約",
          href: "/docs/current-overview",
          icon: FileText,
          color: "blue",
        },
        {
          title: "Architecture",
          description: "アーキテクチャとレイヤー構成",
          href: "/docs/current-architecture",
          icon: Network,
          color: "blue",
        },
        {
          title: "Data Model",
          description: "Prisma/SQLite の現在スキーマ要点",
          href: "/docs/current-data-model",
          icon: FileText,
          color: "blue",
        },
        {
          title: "API Surface",
          description: "現行 API 群の整理",
          href: "/docs/current-api-surface",
          icon: FileText,
          color: "blue",
        },
        {
          title: "Operations",
          description: "運用・監査・バックアップの現行仕様",
          href: "/docs/current-operations",
          icon: Settings,
          color: "orange",
        },
        {
          title: "User Operation Guide",
          description: "現行UIを前提にした利用手順",
          href: "/docs/current-user-operation-guide",
          icon: Users,
          color: "green",
        },
      ],
    },
    {
      category: "Security and Incident",
      items: [
        {
          title: "Security Baseline",
          description: "現行の最小セキュリティ基準",
          href: "/docs/current-security-baseline",
          icon: Shield,
          color: "blue",
        },
        {
          title: "Incident Response Playbook",
          description: "インシデント初動から事後対応まで",
          href: "/docs/current-incident-response-playbook",
          icon: AlertTriangle,
          color: "red",
        },
        {
          title: "Audit Readiness",
          description: "監査時に必要な証跡と運用確認",
          href: "/docs/current-audit-readiness",
          icon: Shield,
          color: "orange",
        },
        {
          title: "Quality Assurance Gates",
          description: "品質ゲート基準",
          href: "/docs/current-quality-assurance-gates",
          icon: Shield,
          color: "blue",
        },
      ],
    },
    {
      category: "Outsourcing Governance",
      items: [
        {
          title: "Document Control Policy",
          description: "文書統制規程（監査・更新ルール）",
          href: "/docs/current-document-control-policy",
          icon: Shield,
          color: "orange",
        },
        {
          title: "Outsourced Maintenance Model",
          description: "外部委託保守の運用モデル",
          href: "/docs/current-outsourced-maintenance-model",
          icon: Settings,
          color: "orange",
        },
        {
          title: "Document Template Standard",
          description: "文書フォーマットと記述基準の統一規程",
          href: "/docs/current-document-template-standard",
          icon: FileText,
          color: "blue",
        },
        {
          title: "Traceability Matrix",
          description: "要件・実装・運用・監査証跡の対応表",
          href: "/docs/current-traceability-matrix",
          icon: Network,
          color: "purple",
        },
        {
          title: "RACI Matrix",
          description: "役割責任分担表",
          href: "/docs/current-raci",
          icon: Users,
          color: "green",
        },
        {
          title: "Change and Release Control",
          description: "変更管理とリリース統制",
          href: "/docs/current-change-and-release-control",
          icon: FileText,
          color: "blue",
        },
        {
          title: "Vendor Handover Checklist",
          description: "委託先引継ぎ手順",
          href: "/docs/current-vendor-handover-checklist",
          icon: AlertTriangle,
          color: "orange",
        },
        {
          title: "Document Register",
          description: "全ドキュメント台帳（Current）",
          href: "/docs/current-document-register",
          icon: FileText,
          color: "blue",
        },
        {
          title: "Migration Status",
          description: "公開版文書への移行状況",
          href: "/docs/current-doc-migration-status",
          icon: AlertTriangle,
          color: "orange",
        },
      ],
    },
    {
      category: "Platform Operations",
      items: [
        {
          title: "Backup and Recovery",
          description: "バックアップ作成と復旧運用の基準",
          href: "/docs/current-backup-and-recovery",
          icon: FileText,
          color: "blue",
        },
        {
          title: "Deployment Baseline",
          description: "配備・更新の最低運用基準",
          href: "/docs/current-deployment-baseline",
          icon: Settings,
          color: "orange",
        },
        {
          title: "Extension Platform",
          description: "拡張基盤の現状と制約",
          href: "/docs/current-extension-platform",
          icon: Network,
          color: "purple",
        },
        {
          title: "Electron Release Operations",
          description: "Electron配布手順の運用標準",
          href: "/docs/current-electron-release-operations",
          icon: FileText,
          color: "blue",
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">システム文書</h1>
          <p className="text-slate-600 mt-2">
            実装準拠の正本文書と、監査・外部委託運用に必要な統制文書の一覧
          </p>
        </div>

        <div className="space-y-8">
          {docs.map((category) => (
            <div key={category.category}>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                {category.category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.items.map((doc) => {
                  const Icon = doc.icon;
                  const colorClasses = {
                    blue: "bg-slate-100 text-slate-600",
                    purple: "bg-purple-100 text-purple-600",
                    green: "bg-green-100 text-green-600",
                    orange: "bg-orange-100 text-orange-600",
                    red: "bg-red-100 text-red-600",
                  };

                  return (
                    <Link
                      key={doc.href}
                      href={doc.href as any}
                      className="rounded-lg border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-3 rounded-lg ${colorClasses[doc.color as keyof typeof colorClasses]}`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 mb-1">
                            {doc.title}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {doc.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-800">
            <strong>注意:</strong>{" "}
            この画面は公開版に同梱されるCurrent文書のみを表示します。
          </p>
        </div>
      </div>
    </main>
  );
}
