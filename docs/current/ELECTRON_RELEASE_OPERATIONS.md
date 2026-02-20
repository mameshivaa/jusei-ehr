# Electron Release Operations (Current)

最終更新: 2026-02-13
文書オーナー: Tech Lead
レビュー周期: 月次

## 1. 目的

Electron配布の作業手順と運用注意点を簡潔に定義する。

## 2. 主要コマンド

- 開発起動: `npm run electron:dev`
- ビルド: `npm run electron:build`
- 配布物生成: `npm run electron:dist`
- OS別配布: `electron:dist:mac`, `electron:dist:win`, `electron:dist:linux`

## 3. リリース前確認

- 品質ゲート通過
- バージョン更新方針確認
- 更新通知設定確認
- 変更履歴更新

## 4. 障害時対応

- 直前安定版へのロールバック
- 配布停止判断
- インシデント報告を実施

## 5. 参照

- `docs/current/CHANGE_AND_RELEASE_CONTROL.md`
- `docs/current/QUALITY_ASSURANCE_GATES.md`
- `docs/current/INCIDENT_RESPONSE_PLAYBOOK.md`
