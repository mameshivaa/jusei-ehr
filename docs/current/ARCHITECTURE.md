# Current Architecture

最終更新: 2026-02-15

## 全体構成

- UI/HTTP入口: Next.js App Router（`src/app`）
- API: Route Handler（`src/app/api/**/route.ts`）
- 業務ロジック: `src/lib/**`
- データ層: Prisma Client（`src/lib/prisma.ts`）+ SQLite（`prisma/prisma/dev.db`）
- デスクトップ実行: Electron（`electron/main.ts`, `electron/preload.ts`）
- 同期サイドカー: Sync Agent（`sync-agent/**`）
- 同期API契約: `sync-contract/src/index.ts`

## レイヤー

1. Presentation
- ページ: `src/app/**/page.tsx`
- コンポーネント: `src/components/**`

2. Application/API
- REST API: `src/app/api/**`
- API認可: `src/lib/auth.ts`, `src/lib/rbac.ts`
- 書き込み制御: `src/lib/api-guard.ts`

3. Domain/Service
- ドメイン処理: `src/lib/charts`, `src/lib/injuries`, `src/lib/documents` など
- 監査: `src/lib/audit.ts`
- セキュリティ: `src/lib/security/**`
- バックアップ: `src/lib/backup/**`

4. Data Access
- Prisma: `src/lib/prisma.ts`
- Schema/Migrations: `prisma/schema.prisma`, `prisma/migrations/**`

5. Sync Sidecar (Separated Runtime)
- 同期制御は別プロセス `sync-agent/**` で実装
- 本体との連携は `src/lib/sync-agent/client.ts` 経由のみ
- 同期フォルダの制御ファイル更新は本体から直接実施しない

## APIドメイン（現実装）

- `patients`, `charts`, `visits`, `treatment-records`, `injuries`, `procedures`
- `documents`, `records`, `reception`
- `auth`, `admin`, `settings`, `setup`, `me`
- `backup`, `audit-logs`, `system`, `cron`
- `sync`
- `extensions`, `marketplace`
- `import`, `export`, `releases`

## システムモード

- `NORMAL`, `READ_ONLY`, `MAINTENANCE`
- READ_ONLY / MAINTENANCE では書き込み操作を拒否可能
- 管理API: `api/admin/system-mode`

## Electron連携

- Main Process: `electron/main.ts`
- Preload: `electron/preload.ts`

## 同期境界（必須）

- 本体 `src/**` は同期フォルダ (`control`, `commits`, `snapshots`, `quarantine`) を直接更新しない
- 同期フォルダ制御ロジックは `sync-agent/**` にのみ配置する
- API契約の変更は `sync-contract/src/index.ts` を先に更新する

## 監査と追跡

- 主要操作は `AuditLog` に集約
- 拡張機能操作は専用監査ラッパー（`src/lib/extensions/audit-extension.ts`）あり
- エクスポート/インポート系は目的・種別を監査メタデータに保存
