# Current Extensibility

最終更新: 2026-02-13

## 結論

このコードベースは将来拡張を前提に設計されており、
「今リリースしたら将来の機能追加が不可能になる」状態ではありません。

## 拡張機能システムの現状

寄与点の実装状況:
- commands: 実装済み
- templates: 実装済み
- exporters: 型定義中心
- integrations: 型定義中心
- views: 型定義中心

実装上の特徴:
- 拡張のDB直アクセスは禁止（App API経由）
- 付与権限 + RBAC の二重チェック
- 拡張操作の監査ログあり
- 拡張状態は `extensions/.extension-state.json` に永続化

## レセコン連携を追加する場合

現時点で活用できる下地:
- 外部連携用フィールド（`externalClaimId`, `externalCode`）
- import/export API
- 監査ログと権限管理

不足している実装:
- integrationsトリガーの実行エンジン
- 再送/失敗管理キュー
- 連携状態（同期時刻・失敗理由）の標準管理

## 推奨実装順

1. 連携テーブル追加
- 例: `ExternalSyncJob`, `ExternalSyncCursor`, `ExternalSyncError`

2. Outbox方式導入
- 業務更新時に連携イベントをOutboxへ記録
- 非同期ワーカーで外部送信

3. 受信口追加
- 連携先からの更新を受ける専用API
- 冪等キーで重複適用を防止

4. 運用整備
- 失敗再送UI
- 同期監査ログの可視化

## DB項目追加の安全運用

- 追加先行（Additive）
- 旧項目は即削除しない
- データ移行を段階化
- 互換性を維持したexport/importを用意

この運用を守れば、将来の同期機能追加に十分対応できます。
