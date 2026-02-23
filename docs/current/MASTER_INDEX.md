# Current Documentation Master Index

最終更新: 2026-02-21
文書オーナー: Product/Engineering
レビュー周期: 月次

この文書は `docs/current/` の統合索引です。

## 1. 読む順番（推奨）

1. `docs/current/OVERVIEW.md`
2. `docs/current/ARCHITECTURE.md`
3. `docs/current/DATA_MODEL.md`
4. `docs/current/API_SURFACE.md`
5. `docs/current/OPERATIONS.md`
6. `docs/current/USER_OPERATION_GUIDE.md`
7. `docs/current/BACKUP_AND_RECOVERY.md`
8. `docs/current/DEPLOYMENT_BASELINE.md`
9. `docs/current/SECURITY_BASELINE.md`
10. `docs/current/INCIDENT_RESPONSE_PLAYBOOK.md`
11. `docs/current/EXTENSIBILITY.md`
12. `docs/current/EXTENSION_PLATFORM.md`
13. `docs/current/ELECTRON_RELEASE_OPERATIONS.md`
14. `docs/current/AUDIT_READINESS.md`
15. `docs/current/DOCUMENT_CONTROL_POLICY.md`
16. `docs/current/DOCUMENT_TEMPLATE_STANDARD.md`
17. `docs/current/TRACEABILITY_MATRIX.md`
18. `docs/current/OUTSOURCED_MAINTENANCE_MODEL.md`
19. `docs/current/RACI.md`
20. `docs/current/CHANGE_AND_RELEASE_CONTROL.md`
21. `docs/current/QUALITY_ASSURANCE_GATES.md`
22. `docs/current/VENDOR_HANDOVER_CHECKLIST.md`
23. `docs/current/DOCUMENT_REGISTER.md`
24. `docs/current/DOC_MIGRATION_STATUS.md`

## 2. 役割別の必読セット

院内運用責任者:

- `docs/current/OPERATIONS.md`
- `docs/current/USER_OPERATION_GUIDE.md`
- `docs/current/RACI.md`
- `docs/current/OUTSOURCED_MAINTENANCE_MODEL.md`

開発者:

- `docs/current/ARCHITECTURE.md`
- `docs/current/DATA_MODEL.md`
- `docs/current/API_SURFACE.md`
- `docs/current/BACKUP_AND_RECOVERY.md`
- `docs/current/TRACEABILITY_MATRIX.md`
- `docs/current/QUALITY_ASSURANCE_GATES.md`

外部委託先（保守ベンダー）:

- `docs/current/OUTSOURCED_MAINTENANCE_MODEL.md`
- `docs/current/VENDOR_HANDOVER_CHECKLIST.md`
- `docs/current/CHANGE_AND_RELEASE_CONTROL.md`
- `docs/current/DOCUMENT_TEMPLATE_STANDARD.md`
- `docs/current/RACI.md`

監査/セキュリティ担当:

- `docs/current/DOCUMENT_CONTROL_POLICY.md`
- `docs/current/AUDIT_READINESS.md`
- `docs/current/TRACEABILITY_MATRIX.md`
- `docs/current/RACI.md`
- `docs/current/DOCUMENT_REGISTER.md`
- `docs/current/DOC_MIGRATION_STATUS.md`

## 3. ソースオブトゥルース（SoT）

- 実装仕様の正: `docs/current/` と実コード
- 公開版に同梱されない旧版資料と矛盾する場合: `docs/current/` を正とする

## 4. 更新ルール

- 機能変更PRには関連する `docs/current/` 更新を必須化
- 重大変更（認証、データモデル、運用手順、外部連携）は `CHANGE_AND_RELEASE_CONTROL` の承認フローを通す
- 文書分類・責任境界は `DOCUMENT_REGISTER` で管理する
- Tier A/B 文書の書式は `DOCUMENT_TEMPLATE_STANDARD` に従う
