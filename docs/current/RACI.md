# RACI Matrix (Current)

最終更新: 2026-02-13
文書オーナー: Product/Engineering
レビュー周期: 四半期
承認者: Product Owner

ロール定義:

- PO: Product Owner（発注側責任者）
- SO: Security Officer（発注側セキュリティ責任者）
- TL: Tech Lead（技術責任者）
- VL: Vendor Lead（受託側責任者）
- AE: Application Engineer（受託側実装者）
- QA: QA Engineer（受託側検証者）
- OP: Operator（院内運用担当）

RACI:

- R: Responsible（実行責任）
- A: Accountable（最終責任）
- C: Consulted（要相談）
- I: Informed（報告先）

| 業務項目                     | PO  | SO  | TL  | VL  | AE  | QA  | OP  |
| ---------------------------- | --- | --- | --- | --- | --- | --- | --- |
| 仕様優先度決定               | A   | C   | R   | C   | I   | I   | C   |
| バグ修正実装                 | I   | I   | A   | R   | R   | C   | I   |
| リリース判定                 | A   | C   | R   | C   | I   | C   | I   |
| 緊急障害初動 (P1)            | A   | C   | R   | R   | R   | I   | C   |
| セキュリティインシデント対応 | C   | A   | R   | C   | R   | C   | I   |
| DBマイグレーション計画       | C   | C   | A   | R   | R   | C   | I   |
| バックアップ/復旧テスト      | I   | C   | A   | R   | C   | R   | R   |
| 文書更新 (`docs/current`)    | C   | C   | A   | R   | R   | C   | I   |
| 旧文書整理判定               | A   | C   | R   | C   | I   | I   | I   |
| 外部委託の受入/解約          | A   | C   | C   | R   | I   | I   | I   |

補足:

- セキュリティ関連のAはSOを優先する。
- 緊急時は暫定対応を許容し、72時間以内に正式文書へ反映する。
