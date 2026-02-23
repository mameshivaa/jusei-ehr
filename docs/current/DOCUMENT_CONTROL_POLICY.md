# Document Control Policy

最終更新: 2026-02-21
文書オーナー: Product/Engineering
レビュー周期: 四半期
承認者: Security Officer + Tech Lead

## 1. 目的

本ポリシーは、V-OSSの文書を監査可能かつ外部委託可能な状態で維持するための統制基準を定義する。

## 2. 適用範囲

- `docs/current/` の全ファイル
- `docs/README.md`
- `README.md` のドキュメント導線
- `src/app/docs/**` のアプリ内文書導線

## 3. 文書分類

Tier A（統制/契約/運用基準）:

- 変更時は承認2者（Tech Lead + Security Officer）
- 例: RACI, 委託運用モデル, 変更管理, 品質ゲート

Tier B（技術仕様）:

- 変更時は承認1者以上（Tech Leadまたは指名レビュア）
- 例: Architecture, Data Model, API Surface

Tier C（参考/履歴）:

- 参照用。更新は任意
- 例: 旧版移行メモ、作業記録（公開版に同梱しない資料を含む）

## 4. 必須メタデータ

Tier A/Bの文書は以下を冒頭に記載する。

- 最終更新日
- 文書オーナー
- レビュー周期
- 承認者（Tier Aのみ必須）
- 規約準拠（`DOCUMENT_TEMPLATE_STANDARD` に適合していること）

## 5. 変更管理

- 文書変更は原則PR経由で実施する
- コード変更と文書変更は同一PRに含める
- PRテンプレートに「関連文書更新」のチェック項目を設ける
- 変更理由と影響範囲をPR説明に明記する
- 領域追加・責任変更時は `TRACEABILITY_MATRIX` を同時更新する

## 6. レビュー周期

- Tier A: 四半期レビュー必須
- Tier B: 半期レビュー必須
- Tier C: 必要時レビュー

レビュー結果は `docs/current/DOCUMENT_REGISTER.md` の `last_reviewed` を更新する。

## 7. 廃止とアーカイブ

- 廃止時は、置換先文書を `docs/current/` に用意する
- 廃止・置換の判断は `DOC_MIGRATION_STATUS` と `DOCUMENT_REGISTER` に記録する
- 公開版に同梱しない資料は履歴管理（Git履歴/別管理）で追跡する

## 8. 例外運用

緊急インシデント時は事後更新を許容するが、72時間以内に正規文書へ反映する。
