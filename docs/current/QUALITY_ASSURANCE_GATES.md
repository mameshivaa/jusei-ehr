# Quality Assurance Gates

最終更新: 2026-02-13
文書オーナー: Tech Lead
レビュー周期: 月次
承認者: Tech Lead

## 1. コード品質ゲート

必須:

- `npm run type-check`
- `npm run lint`

推奨:

- `npm run test`
- `npm run build`

## 2. データ品質ゲート

DB変更時:

- migrationスクリプトのレビュー
- 既存データ影響評価
- バックアップ取得確認
- ロールバック手順確認

## 3. 運用品質ゲート

変更が運用に影響する場合:

- `docs/current/OPERATIONS.md` 更新
- 監査/バックアップ運用への影響記載
- 必要に応じて手順のスクリーンショット更新

## 4. セキュリティ品質ゲート

- 認可漏れチェック（`requireAuth` / `requireRole` / RBAC）
- 入出力バリデーション
- 機密情報のログ出力有無確認
- 監査ログ記録漏れ確認

## 5. 文書品質ゲート

- 変更箇所に対応するCurrent文書を更新
- `DOCUMENT_REGISTER` の `last_reviewed` 更新
- 正本以外の資料へ新仕様を書かない

## 6. リリース判定

以下を満たした場合のみリリース可:

- 技術ゲート通過
- 運用ゲート通過
- 文書ゲート通過
- 重大リスクが合意済み
