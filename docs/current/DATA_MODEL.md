# Current Data Model

最終更新: 2026-02-13

## 基本方針

- DBはSQLite、スキーマ定義はPrisma（`prisma/schema.prisma`）
- 変更はPrisma migrationで管理（`prisma/migrations/**`）
- 既存migration履歴が多数あるため、段階的進化に対応可能

## 主要モデル

業務中核:

- `Patient`
- `Chart`
- `Visit`
- `TreatmentRecord`
- `Injury`
- `TreatmentDetail`
- `ProcedureMaster`

運用・セキュリティ:

- `User`, `UserSession`
- `AuditLog`, `PermissionChangeLog`
- `LoginAttempt`, `EmergencyLog`
- `SystemSettings`, `ConsentRecord`
- `BackupRunLog`, `RecoveryTestLog`
- `ProxyOperation`
- `ScannedDocument`

## 現行スキーマ上の拡張余地

- 将来連携用フィールドを保持済み
- `Injury.externalClaimId`
- `ProcedureMaster.externalCode`
- `TreatmentDetail.unitPrice` など、請求系連携を想定した保持項目あり

## データ互換性の実装傾向

- 患者氏名・住所は旧結合フィールドと新分割フィールドを併存
- Soft delete（`isDeleted`, `deletedAt`, `deletedBy`, `deleteReason`）が複数モデルで実装
- エクスポート/インポートにはバージョン情報を付与

## 変更ガイドライン（推奨）

- 破壊的変更は避け、まず追加で表現する
- 既存カラム削除は「移行完了確認後」に段階実施する
- 外部連携キーは業務キーと分離して保持する
- migrationと同時に `docs/current` を更新する

## よく使うコマンド

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:studio`
- `npm run db:seed`
