# Current API Surface

最終更新: 2026-02-15

この文書は `src/app/api/**/route.ts` の実装ベースで整理しています。

## 主要APIグループ

業務データ:
- `/api/patients`
- `/api/charts`
- `/api/visits`
- `/api/treatment-records`
- `/api/injuries`
- `/api/procedures`
- `/api/documents`
- `/api/records/templates`

認証・管理:
- `/api/auth/*`
- `/api/admin/*`
- `/api/me`
- `/api/settings/*`
- `/api/setup`, `/api/setup/status`

運用:
- `/api/backup/*`
- `/api/audit-logs/*`
- `/api/system/*`
- `/api/cron/*`
- `/api/sync/*`

拡張・外部:
- `/api/extensions/*`
- `/api/marketplace/*`
- `/api/import/*`
- `/api/export/*`

## 認可パターン

- 認証必須: `requireAuth`
- 管理者必須: `requireRole("ADMIN")`
- 複数ロール許可: `requireAnyRole`
- 機能別権限: RBACヘルパー

## 書き込み制御

- システムモードが `READ_ONLY` / `MAINTENANCE` の場合、書き込み拒否可能
- ガード実装: `src/lib/api-guard.ts`

## Import / Export

- Export: JSON / CSV / XML / SQL APIあり
- Import: JSON / CSV / XML APIあり
- SQL Importは「簡易実装（手動実行前提メッセージ）」のため要注意

## 監査ログ連携

- Import/Export/管理操作は監査ログへ記録
- 目的（purpose）や暗号化有無などをメタデータに保存

## API利用時の注意

- 内部利用APIが多いため、外部公開前提の安定契約は未確立
- 外部連携時は専用Facade層を設け、`route.ts` へ直接依存しない
- 破壊的変更時は export/import と docs/current を同時更新する

## ローカル同期サイドカー API（本体分離）

`sync-agent/**` で提供する localhost API（本体 `src/app/api/**` とは別系統）:

- `GET /v1/health`
- `POST /v1/locks/acquire`
- `POST /v1/locks/heartbeat`
- `POST /v1/locks/release`
- `POST /v1/commits`
- `GET /v1/generations?tenant_id=...`
- `POST /v1/rollback`

契約型:
- `sync-contract/src/index.ts`

本体側クライアント:
- `src/lib/sync-agent/client.ts`
