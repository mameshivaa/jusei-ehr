# Documentation Migration Status

最終更新: 2026-02-21

## 目的

公開版の実装準拠文書を `docs/current/` に統一し、参照先を単一化する。

## フェーズ進捗

- Phase 0: `docs/current/` 正本を新設（完了）
- Phase 1: 旧版文書の参照依存を解消（完了）
- Phase 2: README/アプリ内導線を Current へ統一（完了）
- Phase 3: 公開版同梱文書を Current のみに整理（完了）

## 完了内容（要約）

- `/docs` 画面と設定画面の文書導線を Current に統一
- README/QUICK_START を Current 参照へ更新
- 文書台帳を Current 基準で再整理

## 最終状態

- 実装・運用判断の正本: `docs/current/`
- 台帳管理: `docs/current/DOCUMENT_REGISTER.md`
- 運用統制: `docs/current/DOCUMENT_CONTROL_POLICY.md`

## 継続運用ルール

1. 仕様変更PRでは、必ず `docs/current/` を同時更新する
2. 旧版文書の内容を再採用する場合は、Current 文書に再編してから反映する
