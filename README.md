# V-OSS - 接骨院向け電子カルテ（無料配布版）

ローカル1PCで動作する接骨院向けのシンプルな電子カルテシステムです。

## 特徴

- **ローカル完結**: SQLiteデータベースで1PCで完結、インターネット接続不要
- **シンプルな認証**: ユーザー管理とロールベースアクセス制御
- **患者管理**: 患者情報の登録・検索・編集
- **施術記録**: SOAP形式での施術記録作成・管理
- **無料配布**: アプリを無償提供（利用条件は `LICENSE` を参照）

## 技術スタック

- **フロントエンド/バックエンド**: Next.js 14 (App Router), React, TypeScript
- **データベース**: SQLite
- **ORM**: Prisma
- **認証**: ローカルID/パスワード認証
- **スタイリング**: Tailwind CSS

## クイックスタート

### 自動セットアップ（推奨）

```bash
# セットアップスクリプトを実行
./setup.sh
```

このスクリプトは以下を自動的に実行します：

- 依存関係のインストール
- 環境変数ファイル（.env）の作成
- データベースのセットアップ
- シードデータの投入

### 手動セットアップ

#### 1. 依存関係のインストール

```bash
npm install
```

#### 2. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成し、実際の値を設定してください：

```bash
cp .env.example .env
```

**必須設定項目**:

- `DATABASE_URL`: データベース接続URL（例: `file:./prisma/prisma/dev.db`）

#### 3. データベースのセットアップ

```bash
# Prismaクライアントの生成
npm run db:generate

# マイグレーションの実行
npm run db:migrate

# シードデータの投入（デフォルト管理者ユーザー作成）
npm run db:seed
```

#### 4. 開発サーバーの起動

```bash
# 通常モード（認証あり）
npm run dev

# 開発モード（認証スキップ、ログイン不要）
npm run dev:free
```

ブラウザで `http://localhost:3000` を開いてください。

**開発モード（`npm run dev:free`）について**:

- 認証がスキップされ、ログインなしでアクセスできます
- ダミーユーザー（開発ユーザー、管理者権限）として動作します
- セットアップは必要です（初回起動時のみ）

### 5. 初回セットアップ

初回起動時は、セットアップページが表示されます。以下の情報を入力してください：

- **接骨院情報**: 接骨院名、所在地
- **責任者情報**: 責任者（院長）の氏名、メールアドレス
- **管理者アカウント**: ログイン用のメールアドレスとパスワード
- **バックアップ設定**: バックアップ保存先と `BACKUP_SECRET` の設定

詳細は [docs/current/USER_OPERATION_GUIDE.md](./docs/current/USER_OPERATION_GUIDE.md) を参照してください。

## 使用開始について

**重要**: v-ossは無料で公開されていますが、使用条件の確認が必要です。

### 登録方法

1. 開発者に連絡して登録申請を行ってください
2. 配布時の運用手順に従ってセットアップを実施してください
3. 必要な環境変数を`.env`に設定してください

## ログイン方法

セットアップ時に作成した管理者アカウントでログインしてください。

## 使い方

### クイックスタート

初めて使う方は [QUICK_START.md](./QUICK_START.md) を参照してください。

### 詳細な使い方

詳細な使い方は [docs/current/USER_OPERATION_GUIDE.md](./docs/current/USER_OPERATION_GUIDE.md) を参照してください。

### 基本的な流れ

1. **ログイン**: 管理者または許可ユーザーでログイン
2. **患者管理**: 患者の検索・登録・編集
3. **来院記録**: 患者の来院を記録
4. **施術記録**: SOAP形式で施術内容を記録

## 主な機能

### 患者管理

- 患者情報の登録・検索・編集
- 患者ID・保険証番号の管理
- 患者の来院履歴の確認

### 施術記録

- SOAP形式での施術記録作成
  - **S**ubjective（主観的情報）
  - **O**bjective（客観的情報）
  - **A**ssessment（評価・診断）
  - **P**lan（治療計画）
- 記録の編集・削除（楽観的ロック対応）

### ユーザー管理

- 複数ユーザーの登録
- ロールベースアクセス制御（ADMIN, PRACTITIONER, RECEPTION）

## データベース管理

### Prisma Studio（GUI）

```bash
npm run db:studio
```

ブラウザでデータベースの内容を確認・編集できます。

### マイグレーション

```bash
# 新しいマイグレーションを作成
npm run db:migrate

# マイグレーション履歴の確認
npx prisma migrate status
```

## 開発

### 型チェック

```bash
npm run type-check
```

### コードフォーマット

```bash
npm run format
```

### リント

```bash
npm run lint
```

## ライセンス

V Free Application License (Binary-Only)

詳細は [LICENSE](./LICENSE) を参照してください。

## スコープ外（意図的に含めていません）

以下の機能は、無料配布版には含まれていません：

- ライセンス認証 / 課金 / 契約管理
- クラウド同期・監視・ログエクスポート
- Electron パッケージング / 自動アップデート
- マルチテナント対応
- 複雑な監査ログ
- 画像管理
- 請求計算
- 予約システム

## 配布前チェック（無料配布版利用者向けの安全ガイド）

- 必ずMFAを有効化し、本番では `mfaRequired=true` にする
- emergency/API と SystemSettings 更新系はリバプロで院内IPに制限する
- 初期管理者パスワードは配布物に含めず、導入直後に変更する
- ログ/文書の保存期間を院内ポリシーに合わせ決定し、`SystemSettings` を更新する
- 詳細チェックリストは `docs/current/DEPLOYMENT_BASELINE.md` を参照

## コントリビューション

本無料配布版では外部からのプルリクエストやIssue投稿を受け付けていません。問い合わせ方法は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## 開発者向けドキュメント

開発環境のセットアップやアーキテクチャの詳細については、[DEVELOPMENT.md](./DEVELOPMENT.md) を参照してください。
実装準拠の最新ドキュメント索引は [docs/README.md](./docs/README.md) を参照してください。
外部委託向けの統制資料は [docs/current/MASTER_INDEX.md](./docs/current/MASTER_INDEX.md) から参照できます。

## システム設計・運用に関する文書

厚生労働省の「医療情報システムの安全管理に関するガイドライン第6.0版」に準拠した文書：

- [docs/README.md](./docs/README.md) - Current文書索引（推奨入口）
- [docs/current/MASTER_INDEX.md](./docs/current/MASTER_INDEX.md) - Current統合索引
- [docs/current/OPERATIONS.md](./docs/current/OPERATIONS.md) - 運用基準
- [docs/current/SECURITY_BASELINE.md](./docs/current/SECURITY_BASELINE.md) - セキュリティ基準
- [docs/current/INCIDENT_RESPONSE_PLAYBOOK.md](./docs/current/INCIDENT_RESPONSE_PLAYBOOK.md) - インシデント対応
- [docs/current/DOCUMENT_CONTROL_POLICY.md](./docs/current/DOCUMENT_CONTROL_POLICY.md) - 文書統制規程

## データの取扱いについて

- 本アプリはローカル端末内で動作し、患者データや管理情報を外部へ自動送信しません。
- 詳細は [プライバシーポリシー](./src/app/privacy/page.tsx) を参照してください。

## ライセンス

このプロジェクトは [V Free Application License (Binary-Only)](./LICENSE) の条件で配布されています。
