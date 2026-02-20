# セキュリティ対応の参照マップ

詳細手順は各ドキュメントにある。必要になった段階で該当ファイルを読むこと。

## インシデント対応

- `docs/current/INCIDENT_RESPONSE_PLAYBOOK.md`
  - 緊急時の初動、レベル分類、封じ込め、復旧、事後対応

## 技術的セキュリティ対策

- `docs/current/SECURITY_BASELINE.md`
  - 認証/認可、RBAC、監査ログ、データ保護、運用統制

## 運用/復旧

- `docs/current/OPERATIONS.md`
- `docs/current/BACKUP_AND_RECOVERY.md`
- `docs/current/CHANGE_AND_RELEASE_CONTROL.md`

## ガバナンス/監査

- `docs/current/AUDIT_READINESS.md`
- `docs/current/DOCUMENT_CONTROL_POLICY.md`
- `docs/current/RACI.md`

## 法対応

- `LEGAL_COMPLIANCE.md`
- `PRIVACY.md`
- `TERMS.md`

## 監査ログ確認 (抜粋)

- 監査ログ UI: `/logs`（監査ログタブ / 管理者権限）
- 事象調査のエビデンスは時刻・対象ユーザー・操作内容を最低限記録する
