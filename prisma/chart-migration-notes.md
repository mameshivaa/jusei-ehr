## Chartモデル追加メモ（手動マイグレーション方針）

- 新規モデル `Chart` を追加し、`Patient` と 1:N。
- `Injury` と `Visit` に `chartId` を追加（既存の `patientId` は後方互換のため当面残す）。
- 既存データを継続利用する場合は、以下の手順で「デフォルトカルテ」を患者ごとに生成し、関連を更新する。

### SQLite 手動移行例

```sql
-- 1. Chartテーブル作成（Prisma migrate dev を推奨）
-- 2. 各患者にデフォルトChartを作成
INSERT INTO record_templates(id) VALUES ('noop'); -- ダミー（Prismaのマイグレーション適用用に合わせて調整）
```

実運用では `prisma migrate dev --name add_chart_model` を実行し、生成される SQL を確認してください。\*\*\*
