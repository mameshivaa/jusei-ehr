---
name: v-oss-release
description: "Guide V-OSS release tasks: version/changelog updates, release notes, packaging, and Electron distribution. Use when preparing a release, shipping a desktop build, or validating release artifacts."
---

# V-OSS Release

## Overview

V-OSS のリリース作業を、Web/Electron 両方の観点で整理して実行するための手順を示す。

## Workflow

1. リリース範囲を決める
   - Webのみ / Electron配布あり / ドキュメント更新のみ
2. バージョンと変更履歴を更新する
   - `package.json` を更新
   - `CHANGELOG.md` を更新
3. リリースノート/文書を更新する
   - 配布パッケージに同梱するリリースノートの更新
   - 文書更新規程に合わせて必要な docs を更新
4. ビルド/パッケージングを行う
   - Webのみなら通常ビルド
   - Electron配布なら `docs/current/ELECTRON_RELEASE_OPERATIONS.md` の手順に従う
5. 成果物の確認
   - バージョン表示/更新通知/配布物の構成をチェック

## Quick Checks

- `package.json` の version と `CHANGELOG.md` が整合しているか
- Electron を使う場合は `electron-builder.yml` の publish 設定と `GH_TOKEN` を確認
- macOS 公証が必要なら環境変数が設定済みか

## References

- `skills/v-oss-release/references/release-checklist.md`
- `DEVELOPMENT.md`
- `docs/current/ELECTRON_RELEASE_OPERATIONS.md`
- `docs/current/CHANGE_AND_RELEASE_CONTROL.md`
- `docs/current/DOCUMENT_CONTROL_POLICY.md`
- `CHANGELOG.md`
