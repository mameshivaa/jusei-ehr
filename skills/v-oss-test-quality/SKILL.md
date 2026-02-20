---
name: v-oss-test-quality
description: Run or recommend V-OSS test and quality checks (type-check, lint, format, tests, coverage, Prisma/DB checks). Use when validating changes, troubleshooting failures, or preparing a pre-release verification for this repo.
---

# V-OSS Test/Quality

## Overview

V-OSS の品質確認に必要な標準コマンドと、変更内容に応じた実行順序を案内する。

## Quick Start

- 速く確認したい: `npm run type-check` + `npm run lint`
- まとめて確認したい: `npm run quality`
- 変更が大きい/リリース前: `npm run quality` + `npm test` (+ `npm run test:coverage`)

## Workflow

1. 変更範囲を特定する
   - フロントのみ / APIのみ / DBスキーマ変更あり など
2. 最小限のチェックを選ぶ
   - 速さ優先なら type-check + lint
   - 体裁修正が必要なら format
3. フルチェックを実施する
   - `npm run quality` と `npm test` を基準にする
4. DB 変更がある場合の追加手順
   - `npm run db:generate` / `npm run db:migrate` / `npm run db:seed`
5. 失敗時の切り分け
   - 型エラー/キャッシュ疑い: `.next` を削除して再実行
   - SQLite ロック疑い: `prisma/dev.db*` を確認

## References

- `skills/v-oss-test-quality/references/test-quality-workflow.md`
- `DEVELOPMENT.md`
