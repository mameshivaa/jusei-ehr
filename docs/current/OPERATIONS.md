# Current Operations

最終更新: 2026-02-15

## 初期セットアップ

- `POST /api/setup` で初期化
- 管理者アカウント（ID/パスワード）を作成
- バックアップ設定（保存先、secret）を登録
- 規約同意と運用確認項目を記録

## 認証運用

- ローカルセッションCookieでログイン状態を維持
- MFA関連APIあり
- アカウントロック、停止、削除状態をサーバで強制判定

## システムモード

- `NORMAL`: 通常運用
- `READ_ONLY`: 書き込み停止（参照のみ）
- `MAINTENANCE`: メンテナンス停止
- モード変更は監査ログへ記録

## バックアップ

- 手動/自動バックアップAPIあり
- 復元APIあり
- 復旧テストログを保存
- 旧バックアップ配置からの取り込み処理あり

## 同期アドオン運用（任意）

- 同期機能は本体とは別コンポーネント（Sync Add-on）として運用する
- Add-onが停止/異常時は編集操作を停止し、閲覧モードで運用する
- 本体は同期フォルダを直接更新せず、`/api/sync/*` を経由する
- 導入時と変更時に `npm run sync-agent:preflight` を実施する
- テナントごとに同期ルートを分離し、共有しない
- 管理者は `設定 > 拡張機能` 画面で接続状態・世代一覧・ロールバック操作を実行できる
- 管理者は同画面で共有手段（Dropbox/Google Drive/OneDrive/NAS等）と接続先をセットアップできる
- ロールバック実施時は監査ログ（`SYNC_ROLLBACK`）を必須記録する

## 監査

- 主要操作は `AuditLog` へ記録
- エクスポート/インポートは実行目的やフォーマットを記録
- 拡張機能操作は専用アクションで記録

## データ入出力運用

- 出力: JSON/CSV/XML/SQL
- 入力: JSON/CSV/XML
- SQL入力は簡易実装のため、本番運用では手順書化が必要

## リリース前チェック（推奨最小）

- `npm run type-check`
- `npm run lint`
- `npm run test`
- `npm run build`
- 主要APIの疎通確認（setup/auth/patients/backup）

## 委託運用との接続

- 変更の承認フローは `docs/current/CHANGE_AND_RELEASE_CONTROL.md`
- 品質判定は `docs/current/QUALITY_ASSURANCE_GATES.md`
- 役割責任は `docs/current/RACI.md`
