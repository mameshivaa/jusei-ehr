# Traceability Matrix (Current)

最終更新: 2026-02-13
文書オーナー: Product/Engineering
レビュー周期: 月次
承認者: Tech Lead

## 1. 目的

要件、実装、運用、監査証跡の追跡性を確保し、外部委託や監査時の説明責任を担保する。

## 2. マトリクス

| 領域               | 主なコード領域                                                                                                                  | 主なAPI/機能                         | 主なデータ             | 正本ドキュメント                                                                            | 品質証跡                       | 主責任 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| 認証・認可         | `src/lib/auth*`, `src/lib/rbac.ts`, `src/app/auth/**`                                                                           | ログイン、ロール判定、セッション管理 | User, Session          | `SECURITY_BASELINE.md`, `ARCHITECTURE.md`                                                   | type-check, lint, 権限テスト   | TL     |
| 患者管理           | `src/app/patients/**`, `src/components/patients/**`                                                                             | 患者登録/更新/検索                   | Patient                | `API_SURFACE.md`, `DATA_MODEL.md`, `USER_OPERATION_GUIDE.md`                                | 回帰確認、監査ログ確認         | AE     |
| 受付・来院         | `src/app/reception/**`, `src/app/api/reception/**`, `src/app/api/visits/**`                                                     | 来院受付、チェックイン               | Visit                  | `OPERATIONS.md`, `USER_OPERATION_GUIDE.md`                                                  | 手動E2E、運用確認              | OP     |
| カルテ・施術録     | `src/app/charts/**`, `src/components/charts/**`, `src/components/records/**`, `src/app/api/charts/**`, `src/app/api/records/**` | SOAP記録、履歴、PDF                  | Chart, TreatmentRecord | `API_SURFACE.md`, `DATA_MODEL.md`, `OPERATIONS.md`                                          | PDF生成確認、差分確認          | AE     |
| バックアップ・復旧 | `src/components/settings/BackupClient.tsx`, `src/app/settings/backup/**`                                                        | バックアップ作成、復旧手順           | BackupArtifact         | `BACKUP_AND_RECOVERY.md`, `OPERATIONS.md`                                                   | 復旧演習結果                   | OP     |
| データ入出力       | `src/app/settings/data-export/**`, `src/app/settings/data-import/**`, `src/components/settings/Data*Client.tsx`                 | エクスポート/インポート              | ExportFile, ImportLog  | `OPERATIONS.md`, `AUDIT_READINESS.md`                                                       | 監査ログ、作業記録             | OP     |
| 変更・配布         | `package.json`, `CHANGELOG.md`, `electron-builder.yml`                                                                          | バージョン更新、リリース、配布       | ReleaseArtifact        | `CHANGE_AND_RELEASE_CONTROL.md`, `ELECTRON_RELEASE_OPERATIONS.md`, `DEPLOYMENT_BASELINE.md` | type-check, lint, 配布検証     | TL     |
| セキュリティ運用   | `src/app/api/**`, `src/components/settings/AuditLogsClient.tsx`                                                                 | 監査ログ確認、インシデント対応       | AuditLog               | `SECURITY_BASELINE.md`, `INCIDENT_RESPONSE_PLAYBOOK.md`, `AUDIT_READINESS.md`               | インシデント記録、月次レビュー | SO     |
| 文書統制           | `docs/current/**`, `src/app/docs/**`, `src/components/settings/SystemSettingsClient.tsx`                                        | 文書更新、導線維持、台帳管理         | DocumentRegister       | `DOCUMENT_CONTROL_POLICY.md`, `DOCUMENT_REGISTER.md`, `DOCUMENT_TEMPLATE_STANDARD.md`       | 文書レビュー記録               | PO     |

## 3. 運用ルール

- 変更時は、該当領域の「正本ドキュメント」と「品質証跡」を同時更新する。
- 新規領域追加時は本マトリクスに行を追加する。
- 監査時は本マトリクスを入口として証跡を提示する。

## 4. 参照

- `docs/current/MASTER_INDEX.md`
- `docs/current/DOCUMENT_REGISTER.md`
- `docs/current/CHANGE_AND_RELEASE_CONTROL.md`
