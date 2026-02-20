# 開発者向けドキュメント

このドキュメントは、V-OSS の開発環境をセットアップし、プロジェクトに貢献するための詳細な手順を提供します。

## 前提条件

- Node.js 20.0.0 以上
- npm または yarn
- Git

## プロジェクト構造

```
v-oss/
├── prisma/              # Prisma スキーマとマイグレーション
│   ├── schema.prisma    # データベーススキーマ
│   └── seed.ts          # シードデータ
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── api/         # API ルート
│   │   ├── auth/        # 認証ページ
│   │   └── patients/    # 患者管理ページ
│   ├── components/      # React コンポーネント
│   ├── lib/             # ユーティリティ関数
│   └── types/           # TypeScript 型定義
├── public/              # 静的ファイル
└── tests/               # テストファイル
```

## セットアップ

### 1. リポジトリのクローン

社内Gitリポジトリ（非公開）のURLは配布時の開発者向け案内を参照してください。

```bash
git clone <internal-repo-url>
cd v-oss
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env` ファイルを作成し、以下の内容を設定してください：

```env
DATABASE_URL="file:./prisma/prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

`NEXTAUTH_SECRET` は以下のコマンドで生成できます：

```bash
openssl rand -base64 32
```

### 4. データベースのセットアップ

```bash
# Prisma クライアントの生成
npm run db:generate

# マイグレーションの実行
npm run db:migrate

# シードデータの投入
npm run db:seed
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

### 認証モードと運用フラグ

- `NEXT_PUBLIC_AUTH_MODE`（デフォルト: `hybrid`）
  - `google_strict`: 常時Google SSOのみ
  - `hybrid`: 初回セットアップのみSSO必須。クリニック作成後はローカルID/PWも許可
  - `local`: SSO不要。アプリDBのユーザーID/PWでログイン
- ローカル認証のAPI: `POST /api/auth/login`（メール+パスワード）。ローカルセッションは30日有効。
- ログアウト: `POST /api/auth/logout`（Supabaseセッションとローカルセッションを両方破棄）
- 開発用スキップ: `DEV_BYPASS_AUTH=true` で認証を無効化（本番禁止）
- 管理者によるパスワード設定/リセット: 設定 > ユーザー管理 から対象ユーザーを選び「パスワード再設定」。メール送信は行わず、入力したパスワードをbcryptハッシュで保存し失敗カウント/ロックを解除します（スタッフは簡易PW可・4文字以上、重要アカウントは強め推奨）。

### データ境界（OSS版）

- 本リポジトリのOSS版は、利用状況データの外部送信を行いません。
- 患者データ・運用データはローカルDBで管理されます。

## 開発ワークフロー

### ブランチ戦略

- `main`: 本番環境用の安定版
- `develop`: 開発用の統合ブランチ（将来実装）
- `feature/*`: 新機能の開発
- `fix/*`: バグ修正
- `docs/*`: ドキュメントの更新

### コードの品質チェック

```bash
# 型チェック
npm run type-check

# リント
npm run lint

# フォーマット
npm run format

# すべてのチェック
npm run quality
```

### データベースの操作

```bash
# Prisma Studio でデータベースを確認
npm run db:studio

# 新しいマイグレーションを作成
npm run db:migrate

# マイグレーションのリセット（開発環境のみ）
npx prisma migrate reset
```

## アーキテクチャ

### データフロー

1. **フロントエンド**: Next.js App Router を使用
2. **API ルート**: `src/app/api/` に配置
3. **データベース**: Prisma ORM を使用して SQLite にアクセス
4. **認証**: NextAuth.js を使用

### 主要な設計原則

1. **型安全性**: TypeScript を厳格に使用
2. **単一責任の原則**: 各コンポーネント・関数は一つの責務のみ
3. **DRY**: コードの重複を避ける
4. **セキュリティ**: 入力値の検証と適切なエラーハンドリング

## テスト

### テストの実行

```bash
# すべてのテスト
npm test

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test:coverage
```

### テストの書き方

- ユニットテスト: `src/__tests__/unit/`
- 統合テスト: `src/__tests__/integration/`
- E2Eテスト: `src/__tests__/e2e/`

## デバッグ

### 開発ツール

- **Prisma Studio**: データベースの内容を視覚的に確認

  ```bash
  npm run db:studio
  ```

- **Next.js DevTools**: ブラウザの開発者ツールを使用

### よくある問題

#### データベースがロックされている

SQLite のロックエラーが発生した場合：

```bash
# データベースファイルを確認
ls -la prisma/dev.db*

# 必要に応じてリセット
npx prisma migrate reset
```

#### 型エラー

```bash
# Prisma クライアントを再生成
npm run db:generate

# TypeScript のキャッシュをクリア
rm -rf .next
npm run type-check
```

## パフォーマンス

### 最適化のヒント

1. **データベースクエリ**: N+1 問題を避ける
2. **画像最適化**: Next.js の Image コンポーネントを使用
3. **バンドルサイズ**: 不要な依存関係を削除

## セキュリティ

### ベストプラクティス

1. **環境変数**: 機密情報は `.env` に保存（`.gitignore` に含まれていることを確認）
2. **入力検証**: Zod スキーマを使用してすべての入力を検証
3. **認証**: NextAuth.js のセッション管理を適切に使用
4. **SQL インジェクション**: Prisma を使用することで自動的に防止

## リリースプロセス

1. **バージョンの更新**: `package.json` のバージョンを更新
2. **CHANGELOG の更新**: 変更内容を記録
3. **タグの作成**: Git タグを作成
4. **リリースノート**: 配布パッケージに同梱するリリースノートを更新

## 参考資料

- [Next.js ドキュメント](https://nextjs.org/docs)
- [Prisma ドキュメント](https://www.prisma.io/docs)
- [NextAuth.js ドキュメント](https://next-auth.js.org/)
- [TypeScript ドキュメント](https://www.typescriptlang.org/docs/)

## サポート

質問や問題がある場合は、以下でサポートを受けられます：

- サポート窓口（メール/問い合わせフォーム）: バグ報告・機能リクエスト・質問
- コントリビューションガイド: [CONTRIBUTING.md](./CONTRIBUTING.md)
