# Security Baseline (Current)

最終更新: 2026-02-13
文書オーナー: Security Officer
レビュー周期: 四半期
承認者: Security Officer

## 1. 目的

本書はV-OSSの現行実装に対する最小セキュリティ基準を定義する。

## 2. 認証・認可

- サーバ側ガードを必須化（`requireAuth`, `requireRole`, `requireAnyRole`）
- ローカルセッションCookieによる認証維持
- ロールベースアクセス制御（ADMIN/PRACTITIONER/RECEPTION）
- MFA機能を提供し、本番では有効化を推奨

## 3. データ保護

- 個人情報は暗号化対象を明確化
- バックアップは保護された保存方式を使用
- 削除系はソフトデリートと監査を優先

## 4. 監査と追跡

- 重要操作を監査ログへ記録
- セキュリティ影響のある設定変更を記録
- エクスポート/インポート操作を記録

## 5. 運用統制

- 変更管理は `CHANGE_AND_RELEASE_CONTROL` に従う
- 品質判定は `QUALITY_ASSURANCE_GATES` に従う
- 緊急対応は `INCIDENT_RESPONSE_PLAYBOOK` に従う

## 6. 最低チェック項目

- 認可漏れがない
- 入力検証がある
- 監査ログが残る
- 秘密情報がログに露出していない
- バックアップ/復旧手順が有効
