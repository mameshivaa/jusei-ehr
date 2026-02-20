# リリース手順の要点

このリポジトリの基本手順は `DEVELOPMENT.md` と `docs/current/ELECTRON_RELEASE_OPERATIONS.md` にある。詳細確認が必要なときは原文を読むこと。

## コア手順 (抜粋)

- `package.json` のバージョン更新
- `CHANGELOG.md` の更新
- 配布パッケージに同梱するリリースノートの更新
- 必要に応じて Electron ビルド/配布

## Electron 配布 (抜粋)

- ビルド: `npm run electron:build` / `npm run electron:dist`
- GitHub Releases を使う場合は `electron-builder.yml` の publish 設定と `GH_TOKEN` を確認
- macOS 公証が必要な場合は環境変数を設定

## ドキュメント更新のルール

- 文書管理の更新タイミング・承認・バージョン表記は `docs/current/DOCUMENT_CONTROL_POLICY.md` を参照

## 参照元

- `DEVELOPMENT.md`
- `docs/current/ELECTRON_RELEASE_OPERATIONS.md`
- `docs/current/CHANGE_AND_RELEASE_CONTROL.md`
- `docs/current/DOCUMENT_CONTROL_POLICY.md`
- `CHANGELOG.md`
