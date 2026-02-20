# Deployment Baseline (Current)

最終更新: 2026-02-13
文書オーナー: Tech Lead
レビュー周期: 月次

## 1. 目的

安全に配布・更新・運用開始するための最小チェックを定義する。

## 2. 配布前チェック

- `npm run type-check`
- `npm run lint`
- `npm run build`
- 主要API疎通確認
- 監査ログ確認

## 3. 初期運用チェック

- 管理者設定とMFA
- バックアップ先の確認
- 復旧テスト実施
- 監査設定の確認

## 4. 更新時チェック

- 変更管理フロー承認
- ロールバック手順確認
- 文書更新確認

## 5. 参照

- `docs/current/CHANGE_AND_RELEASE_CONTROL.md`
- `docs/current/QUALITY_ASSURANCE_GATES.md`
- `docs/current/VENDOR_HANDOVER_CHECKLIST.md`
