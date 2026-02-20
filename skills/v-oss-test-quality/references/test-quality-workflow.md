# テスト/品質チェックの要点

このリポジトリの標準手順は `DEVELOPMENT.md` にある。詳細確認が必要なときはそちらを読むこと。

## 主要コマンド

- 型チェック: `npm run type-check`
- リント: `npm run lint`
- フォーマット: `npm run format`
- すべて: `npm run quality`
- テスト: `npm test`
- テスト(ウォッチ): `npm run test:watch`
- カバレッジ: `npm run test:coverage`

## DB/Prisma 関連の品質確認

- クライアント生成: `npm run db:generate`
- マイグレーション: `npm run db:migrate`
- シード: `npm run db:seed`

## よくある問題 (抜粋)

- 型エラー時は `.next` を削除して再実行するケースがある: `rm -rf .next`
- SQLite ロックの可能性がある場合は `prisma/dev.db*` の状態を確認

## 参照元

- `DEVELOPMENT.md`
