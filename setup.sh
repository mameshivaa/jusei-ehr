#!/bin/bash

# V-OSS セットアップスクリプト
# このスクリプトは開発環境を自動的にセットアップします

set -e

echo "🚀 V-OSS セットアップを開始します..."

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Node.js のバージョンチェック
echo "📦 Node.js のバージョンを確認中..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js がインストールされていません${NC}"
    echo "Node.js 20.0.0 以上をインストールしてください: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Node.js 20.0.0 以上を推奨します（現在: $(node -v)）${NC}"
fi

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

# .env ファイルの作成
if [ ! -f .env ]; then
    echo "⚙️  .env ファイルを作成中..."
    
    # NEXTAUTH_SECRET の生成
    if command -v openssl &> /dev/null; then
        NEXTAUTH_SECRET=$(openssl rand -base64 32)
    else
        NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
    fi
    
    cat > .env << EOF
DATABASE_URL="file:./prisma/prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# 開発モード: trueで認証・セットアップをスキップ
DEV_BYPASS_AUTH="true"
EOF
    
    echo -e "${GREEN}✅ .env ファイルを作成しました${NC}"
else
    echo -e "${YELLOW}⚠️  .env ファイルは既に存在します${NC}"
fi

# Prisma クライアントの生成
echo "🔧 Prisma クライアントを生成中..."
npm run db:generate

# データベースマイグレーション
echo "🗄️  データベースマイグレーションを実行中..."
npm run db:migrate

# シードデータの投入
echo "🌱 シードデータを投入中..."
npm run db:seed

echo ""
echo -e "${GREEN}✅ セットアップが完了しました！${NC}"
echo ""
echo "次のコマンドで開発サーバーを起動できます:"
echo -e "${YELLOW}  npm run dev${NC}"
echo ""
echo -e "${GREEN}開発モードが有効です (DEV_BYPASS_AUTH=true)${NC}"
echo "認証とセットアップをスキップして、直接ダッシュボードにアクセスできます。"
echo ""
echo "本番モードでテストする場合は .env の DEV_BYPASS_AUTH を false に変更してください。"
echo ""
echo -e "${RED}⚠️  本番環境では DEV_BYPASS_AUTH を削除または false に設定してください！${NC}"

