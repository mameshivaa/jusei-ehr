# プロジェクト構造

このドキュメントは、V-OSS のプロジェクト構造を説明します。

## ディレクトリ構造

```
v-oss/
├── .github/                    # GitHub設定
│   ├── ISSUE_TEMPLATE/         # イシューテンプレート
│   ├── workflows/               # GitHub Actions
│   └── PULL_REQUEST_TEMPLATE.md # PRテンプレート
├── prisma/                      # Prisma設定
│   ├── schema.prisma           # データベーススキーマ
│   ├── seed.ts                 # シードデータ
│   └── migrations/             # マイグレーションファイル
├── public/                      # 静的ファイル
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # API ルート
│   │   │   ├── auth/            # 認証API
│   │   │   ├── patients/        # 患者管理API
│   │   │   ├── treatment-records/ # 施術記録API
│   │   │   └── visits/          # 来院記録API
│   │   ├── auth/                # 認証ページ
│   │   │   └── signin/          # ログインページ
│   │   ├── patients/            # 患者管理ページ
│   │   │   ├── [id]/            # 患者詳細
│   │   │   │   ├── edit/        # 患者編集
│   │   │   │   └── visits/      # 来院記録
│   │   │   ├── new/             # 新規患者登録
│   │   │   └── page.tsx         # 患者一覧
│   │   ├── globals.css          # グローバルスタイル
│   │   ├── layout.tsx           # ルートレイアウト
│   │   └── page.tsx             # ホームページ
│   ├── components/              # React コンポーネント
│   │   ├── patients/            # 患者関連コンポーネント
│   │   ├── records/             # 施術記録関連コンポーネント
│   │   └── providers.tsx        # プロバイダー
│   ├── lib/                      # ユーティリティ関数
│   │   ├── auth.ts              # 認証ヘルパー
│   │   └── prisma.ts            # Prisma クライアント
│   └── types/                    # TypeScript 型定義
├── .editorconfig                # エディタ設定
├── .env.example                 # 環境変数テンプレート
├── .gitignore                   # Git除外設定
├── CHANGELOG.md                 # 変更履歴
├── CONTRIBUTING.md              # コントリビューションガイド
├── DEVELOPMENT.md               # 開発者向けドキュメント
├── LICENSE                      # ライセンス
├── next.config.js               # Next.js設定
├── package.json                 # 依存関係
├── postcss.config.js            # PostCSS設定
├── PROJECT_STRUCTURE.md         # このファイル
├── README.md                    # プロジェクト説明
├── setup.sh                     # セットアップスクリプト
├── tailwind.config.js           # Tailwind CSS設定
└── tsconfig.json                # TypeScript設定
```

## 主要なディレクトリの説明

### `/src/app`

Next.js App Router を使用したページとAPIルートが配置されています。

- **`/api`**: API エンドポイント

  - `/auth`: 認証関連のAPI
  - `/patients`: 患者管理API
  - `/treatment-records`: 施術記録API
  - `/visits`: 来院記録API

- **`/auth`**: 認証ページ

  - `/signin`: ログインページ

- **`/patients`**: 患者管理ページ
  - `/`: 患者一覧
  - `/new`: 新規患者登録
  - `/[id]`: 患者詳細
  - `/[id]/edit`: 患者編集
  - `/[id]/visits/[visitId]`: 来院記録詳細
  - `/[id]/visits/[visitId]/records/new`: 新規施術記録作成
  - `/[id]/visits/[visitId]/records/[recordId]/edit`: 施術記録編集

### `/src/components`

再利用可能なReactコンポーネントが配置されています。

- **`/patients`**: 患者関連コンポーネント

  - `PatientList.tsx`: 患者一覧表示
  - `PatientForm.tsx`: 患者登録・編集フォーム
  - `PatientSearchForm.tsx`: 患者検索フォーム
  - `AddVisitButton.tsx`: 来院記録追加ボタン

- **`/records`**: 施術記録関連コンポーネント
  - `TreatmentRecordList.tsx`: 施術記録一覧表示
  - `TreatmentRecordForm.tsx`: 施術記録作成・編集フォーム

### `/src/lib`

共通のユーティリティ関数とヘルパーが配置されています。

- `prisma.ts`: Prisma クライアントのシングルトンインスタンス
- `auth.ts`: 認証関連のヘルパー関数

### `/prisma`

データベーススキーマとマイグレーションが配置されています。

- `schema.prisma`: データベーススキーマ定義
- `seed.ts`: シードデータ（初期データ）
- `migrations/`: マイグレーションファイル（自動生成）

## ファイル命名規則

- **コンポーネント**: PascalCase（例: `PatientForm.tsx`）
- **ユーティリティ**: camelCase（例: `auth.ts`）
- **ページ**: Next.js App Router の規則に従う（例: `page.tsx`, `route.ts`）
- **型定義**: `.d.ts` 拡張子

## データフロー

1. **ユーザーアクション** → ページコンポーネント（`src/app/`）
2. **フォーム送信** → API ルート（`src/app/api/`）
3. **データ処理** → Prisma クライアント（`src/lib/prisma.ts`）
4. **データベース** → SQLite（`prisma/dev.db`）

## 依存関係の管理

- **ランタイム依存**: `package.json` の `dependencies`
- **開発依存**: `package.json` の `devDependencies`
- **データベース**: Prisma スキーマ（`prisma/schema.prisma`）

## 設定ファイル

- **TypeScript**: `tsconfig.json`
- **Next.js**: `next.config.js`
- **Tailwind CSS**: `tailwind.config.js`
- **PostCSS**: `postcss.config.js`
- **Prettier**: `.prettierrc`（暗黙的な設定）
- **ESLint**: `eslint.config.js`（Next.js のデフォルト設定）
