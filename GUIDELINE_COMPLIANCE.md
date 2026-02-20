# 医療情報システムの安全管理に関するガイドライン準拠

本システムは、厚生労働省の「[医療情報システムの安全管理に関するガイドライン第6.0版](https://www.mhlw.go.jp/content/10808000/001582980.pdf)」に準拠するよう設計されています。

## 1.1 安全管理に関する法制度等による要求事項

### ✅ 個人情報保護法における安全管理措置

- 個人情報の暗号化（AES-256-GCM）
- アクセスログの記録
- アクセス制御

詳細は [LEGAL_COMPLIANCE.md](./LEGAL_COMPLIANCE.md) を参照してください。

### ✅ e-文書法に関する対応

- 電子署名（確定済み施術記録）
- タイムスタンプ
- 改ざん検出

詳細は [LEGAL_COMPLIANCE.md](./LEGAL_COMPLIANCE.md) を参照してください。

## 実装済みの対策

### 1. 真正性の確保

#### ✅ 入力者及び確定者の識別及び認証

- Googleログインによる認証
- セッション管理（JWT）
- ロールベースアクセス制御

#### ✅ 記録の確定手順の確立と、作成責任者の識別情報の記録

- 施術記録に `isConfirmed`, `confirmedBy`, `confirmedAt` フィールドを追加
- 確定APIエンドポイント: `/api/treatment-records/[id]/confirm`
- 確定者情報を記録

#### ✅ 更新履歴の保管

- `TreatmentRecordHistory` モデルで更新履歴を記録
- 変更前後の値、変更者、変更日時、変更理由を保存
- すべての作成・更新・削除・確定操作を記録

#### ✅ 代行操作の承認機能

- `ProxyOperation` モデルで代行操作を管理
- 承認フロー（PENDING → APPROVED/REJECTED）
- 代行理由の記録

### 2. 監査ログ

#### ✅ 操作ログの記録

- `AuditLog` モデルで全操作を記録
- 記録内容:
  - 操作者（ユーザーID）
  - 操作種別（CREATE, UPDATE, DELETE, CONFIRM等）
  - 対象エンティティ（PATIENT, TREATMENT_RECORD等）
  - IPアドレス、ユーザーエージェント
  - タイムスタンプ
  - チェックサム（改ざん防止）

#### ✅ 監査ログの閲覧

- 管理者専用: `/logs`（監査ログタブ）
- フィルター機能（対象、操作、日付範囲）
- ページネーション

### 3. 保存性の確保

#### ✅ データの整合性

- 楽観的ロック（versionフィールド）
- トランザクション処理
- 削除フラグによる論理削除

#### ⚠️ バックアップ機能

- 実装予定（TODO）

### 4. 機密性の確保

#### ✅ アクセス制御

- ロールベースアクセス制御（ADMIN, PRACTITIONER, RECEPTION）
- 認証必須のAPIエンドポイント
- 管理者専用機能の保護

#### ⚠️ 暗号化

- データベース暗号化は実装予定（SQLiteの制約により、アプリケーションレベルでの暗号化を検討）

## ガイドライン対応表

| ガイドライン項目               | 実装状況 | 実装ファイル                                          |
| ------------------------------ | -------- | ----------------------------------------------------- |
| 入力者及び確定者の識別及び認証 | ✅       | `src/lib/auth-config.ts`                              |
| 記録の確定手順の確立           | ✅       | `src/app/api/treatment-records/[id]/confirm/route.ts` |
| 更新履歴の保管                 | ✅       | `src/lib/treatment-record-history.ts`                 |
| 代行操作の承認機能             | ✅       | `prisma/schema.prisma` (ProxyOperation)               |
| 操作ログの記録                 | ✅       | `src/lib/audit.ts`                                    |
| 監査ログの閲覧                 | ✅       | `src/app/logs/page.tsx`                               |
| データの整合性                 | ✅       | 楽観的ロック（version）                               |
| バックアップ機能               | ⚠️       | 実装予定                                              |

## 使用方法

### 施術記録の確定

```typescript
// POST /api/treatment-records/[id]/confirm
// 記録を確定し、確定者情報を記録
```

### 監査ログの確認

1. 管理者でログイン
2. `/logs` を開き「監査ログ」タブを選択
3. フィルターで検索・確認

### 更新履歴の確認

施術記録の詳細ページで更新履歴を確認できます（実装予定）。

## 2. システム設計・運用に必要な規程類と文書体系

### ✅ 遵守事項①: 機能仕様及び利用方法に関する資料の整備

- [SYSTEM_SPECIFICATION.md](./SYSTEM_SPECIFICATION.md) - 機能仕様書
- [USER_GUIDE.md](./USER_GUIDE.md) - ユーザー向け操作マニュアル

### ✅ 遵守事項②: 全体構成図・システム責任者一覧の作成

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - システム構成図
- [SYSTEM_STAKEHOLDERS.md](./SYSTEM_STAKEHOLDERS.md) - システム責任者・関係者一覧

### ✅ 遵守事項③: 維持及び運用に必要な手順の整備

- [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md) - 運用マニュアル

### ✅ 遵守事項④: 利用者向けマニュアルの整備

- [USER_GUIDE.md](./USER_GUIDE.md) - ユーザー向け操作マニュアル
- [QUICK_START.md](./QUICK_START.md) - クイックスタートガイド

### ✅ 遵守事項⑤: 非常時・インシデント対応手順の作成

- [EMERGENCY_PROCEDURES.md](./EMERGENCY_PROCEDURES.md) - 非常時対応手順
- [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md) - セキュリティインシデント対応手順

### ✅ 文書管理規程

- [DOCUMENTATION_MANAGEMENT.md](./DOCUMENTATION_MANAGEMENT.md) - 文書管理規程

## 3. 責任分界 [Ⅰ～Ⅳ]

### ✅ 遵守事項①: 事業者情報の確認

- Google OAuthの機能仕様とセキュリティ対策を確認
- 外部連携サービスの機能仕様とセキュリティ対策を確認
- 提供情報の正確性を確認
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md), [SERVICE_SPECIFICATION_DISCLOSURE.md](./SERVICE_SPECIFICATION_DISCLOSURE.md)

### ✅ 遵守事項②: 要求仕様適合性の確認と調整

- 外部サービスの要求仕様との適合性を確認
- リスク評価との齟齬がないことを確認
- 必要に応じて調整を実施
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md), [SERVICE_SPECIFICATION_DISCLOSURE.md](./SERVICE_SPECIFICATION_DISCLOSURE.md)

### ✅ 遵守事項③: 通常時・非常時の役割分担

- 通常時の運用における責任分界を明確化
- 非常時の運用における責任分界を明確化
- 障害発生時の対応責任を明確化
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md), [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md), [EMERGENCY_PROCEDURES.md](./EMERGENCY_PROCEDURES.md)

### ✅ 遵守事項④: サイバー攻撃時の責任分界

- 技術的な対応の責任分界を明確化
- 対外的な説明の責任分界を明確化
- インシデント対応の役割分担を明確化
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md), [SECURITY_INCIDENT_RESPONSE.md](./SECURITY_INCIDENT_RESPONSE.md)

### ✅ 遵守事項⑤: 第三者提供時の責任分界

- データの第三者提供時の責任分界を明確化
- リスク評価に基づく責任分界の範囲を検討
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md)

### ✅ 3.3 医療機関等が負う責任に関する責任分界

#### ✅ 3.3.1 通常時の運用における責任分界

- 運用責任や管理責任の取り決め
- 事業者からの実施報告の管理
- 再委託先の実施状況の報告管理
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md) セクション8.1

#### ✅ 3.3.2 非常時の運用における責任分界

- 被害拡大防止や原因究明の責任分界
- 外部への説明責任に関する支援
- サイバー攻撃時の専門的知見の必要性
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md) セクション8.2

### ✅ 4. リスクアセスメントを踏まえた安全管理対策の設計

#### ✅ 遵守事項①: 情報管理手順の作成と運用

- 情報種別による重要度を踏まえた管理
- 患者ごとに識別できる措置
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md) セクション9.1

#### ✅ 遵守事項②: 事業者から技術的対策等の情報を確認

- サービス仕様適合開示書の利用
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md) セクション9.2, [SERVICE_SPECIFICATION_DISCLOSURE.md](./SERVICE_SPECIFICATION_DISCLOSURE.md)

#### ✅ 4.1 情報資産の種別に応じた安全管理の設計

- 情報資産の棚卸
- 情報種別の整理（患者情報、システム情報等）
- 法令による保存要件の確認
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md) セクション9.3

#### ✅ 4.2 リスクアセスメントを踏まえた安全管理対策の設計

- リスク分析とリスク評価
- 安全管理対策の実装と運用
- **実装**: [RESPONSIBILITY_DEMARCATION.md](./RESPONSIBILITY_DEMARCATION.md) セクション9.4

## 5. システム設計の見直し（標準化対応、新規技術導入のための評価等） [Ⅰ、Ⅲ]

### ✅ 遵守事項①: 標準形式でのデータ出力・入力機能

- **実装**: 標準形式が存在する項目は標準形式で、標準形式が存在しない項目は変換が容易なデータ形式で出力・入力
- **対応形式**:
  - JSON形式（`src/lib/data-export/json-exporter.ts`, `src/lib/data-import/json-importer.ts`）
  - CSV形式（`src/lib/data-export/csv-exporter.ts`, `src/lib/data-import/csv-importer.ts`）
  - XML形式（`src/lib/data-export/xml-exporter.ts`, `src/lib/data-import/xml-importer.ts`）
  - SQL形式（`src/lib/data-export/sql-exporter.ts`, `src/lib/data-import/sql-importer.ts`）
- **UI**: `/settings/data-export`, `/settings/data-import`
- **API**: `/api/export/[format]`, `/api/import/[format]`

### ✅ 遵守事項②: マスタデータベース変更時の影響防止

- **実装**: マスタデータベースの変更が、過去の診療録等の情報に対する内容の変更を起こさない機能
- **実装ファイル**: `src/lib/data-integrity/checker.ts`
- **機能**: データ整合性チェック機能により、参照整合性を検証

### ✅ 遵守事項③: データ形式・転送プロトコルのバージョン管理

- **実装**: データ形式と転送プロトコルのバージョン管理と継続性の確保
- **実装ファイル**: `src/lib/data-export/version.ts`
- **機能**:
  - データ形式バージョン管理（`DATA_FORMAT_VERSION`）
  - スキーマバージョン管理（`SCHEMA_VERSION`）
  - バージョン互換性チェック（`isVersionCompatible`）
  - エクスポートメタデータにバージョン情報を含める

### ✅ 遵守事項④: 電子媒体保存情報と見読化手段の対応付け管理

- **実装**: 電子媒体に保存された情報と、その見読化手段（情報機器、ソフトウェア、関連情報）の対応付け管理
- **実装ファイル**: `src/lib/data-export/metadata.ts`
- **機能**:
  - 見読化手段の要件をメタデータに含める（`getReadabilityRequirements`）
  - エクスポートデータに必要なソフトウェア、バージョン、依存関係を記録
  - エクスポートメタデータに見読化要件を含める

### 実装状況

| ガイドライン項目                           | 実装状況 | 実装ファイル                                           |
| ------------------------------------------ | -------- | ------------------------------------------------------ |
| 標準形式でのデータ出力・入力機能           | ✅       | `src/lib/data-export/*.ts`, `src/lib/data-import/*.ts` |
| マスタデータベース変更時の影響防止         | ✅       | `src/lib/data-integrity/checker.ts`                    |
| データ形式・転送プロトコルのバージョン管理 | ✅       | `src/lib/data-export/version.ts`                       |
| 電子媒体保存情報と見読化手段の対応付け管理 | ✅       | `src/lib/data-export/metadata.ts`                      |

## 6. 安全管理を実現するための技術的対策の体系 [Ⅰ～Ⅳ]

### ✅ 遵守事項①: システム運用担当者が技術的な対応を検討する際の参考体系

システム運用担当者は、医療情報システムの安全管理に関する技術的な対応を検討する際に、以下の体系に従った内容を参考として検討します。

#### ✅ クライアント側

- **情報の持出し・管理・破棄等に関する安全管理措置**

  - データエクスポート時の安全管理（暗号化、アクセス制御、監査ログ）
  - エクスポートデータの保存場所とアクセス制御
  - データの破棄手順（完全削除、物理的破棄）
  - データの持出し時の注意事項（USBメモリ、クラウドストレージ等）
  - **実装**: [CLIENT_SECURITY.md](./CLIENT_SECURITY.md) セクション2

- **利用機器・サービスに対する安全管理措置**
  - 推奨ブラウザとバージョン
  - ブラウザのセキュリティ設定
  - オペレーティングシステムのセキュリティ更新
  - アンチウイルスソフトウェアの推奨
  - ファイアウォール設定
  - **実装**: [CLIENT_SECURITY.md](./CLIENT_SECURITY.md) セクション3

#### ✅ サーバ側

- **ソフトウェア・サービスに対する要求事項**

  - Next.js、React、Prisma等の依存ライブラリのバージョン管理
  - セキュリティ更新の適用手順
  - 脆弱性スキャンの実施方法
  - **実装**: [SERVER_SECURITY.md](./SERVER_SECURITY.md) セクション2

- **事業者による保守対応等に対する安全管理措置**

  - 外部サービス（Google OAuth等）の保守対応
  - セキュリティインシデント発生時の連絡体制
  - **実装**: [SERVER_SECURITY.md](./SERVER_SECURITY.md) セクション3

- **事業者選定と管理**

  - Google OAuthの選定理由と管理方法
  - 外部連携サービスの選定理由と管理方法
  - 外部サービスの変更時の対応手順
  - **実装**: [SERVER_SECURITY.md](./SERVER_SECURITY.md) セクション4

- **システム運用管理（通常時・非常時等）**
  - 通常時の運用手順（OPERATIONS_MANUAL.mdへの参照）
  - 非常時の運用手順（EMERGENCY_PROCEDURES.mdへの参照）
  - **実装**: [SERVER_SECURITY.md](./SERVER_SECURITY.md) セクション5

#### ✅ インフラ

- **物理的安全管理措置（サーバルーム等、バックアップ）**

  - ローカル1PC運用における物理的安全管理
    - PCの設置場所とアクセス制御
    - PCのロック機能（画面ロック、BIOSパスワード等）
    - PCの盗難・紛失対策
  - バックアップの保存場所とアクセス制御
    - バックアップファイルの暗号化
    - バックアップの物理的保管場所
    - バックアップの定期確認手順
  - **実装**: [INFRASTRUCTURE_SECURITY.md](./INFRASTRUCTURE_SECURITY.md) セクション2

- **ネットワークに関する安全管理措置**

  - ローカル運用におけるネットワークセキュリティ
    - ローカルネットワークの分離（可能な場合）
    - ファイアウォール設定
    - 不要なネットワークサービスの無効化
  - インターネット接続時のセキュリティ
    - HTTPS通信の強制
    - 証明書の検証
    - プロキシ設定（必要に応じて）
  - **実装**: [INFRASTRUCTURE_SECURITY.md](./INFRASTRUCTURE_SECURITY.md) セクション3

- **インフラ運用管理（通常時・非常時等）**
  - 通常時のインフラ運用手順
  - 非常時のインフラ運用手順（EMERGENCY_PROCEDURES.mdへの参照）
  - **実装**: [INFRASTRUCTURE_SECURITY.md](./INFRASTRUCTURE_SECURITY.md) セクション4

#### ✅ セキュリティ

- **認証・認可に関する安全管理措置**

  - Google OAuth認証の仕組みとセキュリティ対策
  - セッション管理の仕組みとセキュリティ対策
  - ロールベースアクセス制御（RBAC）の仕組み
  - パスワードポリシー（将来の拡張時）
  - **実装**: [SECURITY_MEASURES.md](./SECURITY_MEASURES.md) セクション2

- **電子署名、タイムスタンプ**

  - 電子署名の仕組みと検証方法
  - タイムスタンプの仕組みと検証方法
  - 改ざん検出の仕組み
  - **実装**: [SECURITY_MEASURES.md](./SECURITY_MEASURES.md) セクション3

- **証跡のレビュー、システム監査**

  - 監査ログの確認方法
  - 監査ログの定期レビュー手順
  - システム監査の実施方法
  - **実装**: [SECURITY_MEASURES.md](./SECURITY_MEASURES.md) セクション4

- **外部からの攻撃に対する安全管理措置**
  - ローカル運用における外部攻撃対策
    - ファイアウォール設定
    - 不要なポートの閉鎖
    - セキュリティ更新の適用
  - インターネット接続時の攻撃対策
    - HTTPS通信の強制
    - セキュリティヘッダーの設定
    - レート制限（将来の拡張時）
  - **実装**: [SECURITY_MEASURES.md](./SECURITY_MEASURES.md) セクション5

### 実装状況

| ガイドライン項目                           | 実装状況 | 実装ファイル                                               |
| ------------------------------------------ | -------- | ---------------------------------------------------------- |
| クライアント側: 情報の持出し・管理・破棄等 | ✅       | [CLIENT_SECURITY.md](./CLIENT_SECURITY.md)                 |
| クライアント側: 利用機器・サービス         | ✅       | [CLIENT_SECURITY.md](./CLIENT_SECURITY.md)                 |
| サーバ側: ソフトウェア・サービス           | ✅       | [SERVER_SECURITY.md](./SERVER_SECURITY.md)                 |
| サーバ側: 事業者による保守対応             | ✅       | [SERVER_SECURITY.md](./SERVER_SECURITY.md)                 |
| サーバ側: 事業者選定と管理                 | ✅       | [SERVER_SECURITY.md](./SERVER_SECURITY.md)                 |
| サーバ側: システム運用管理                 | ✅       | [SERVER_SECURITY.md](./SERVER_SECURITY.md)                 |
| インフラ: 物理的安全管理                   | ✅       | [INFRASTRUCTURE_SECURITY.md](./INFRASTRUCTURE_SECURITY.md) |
| インフラ: ネットワーク                     | ✅       | [INFRASTRUCTURE_SECURITY.md](./INFRASTRUCTURE_SECURITY.md) |
| インフラ: インフラ運用管理                 | ✅       | [INFRASTRUCTURE_SECURITY.md](./INFRASTRUCTURE_SECURITY.md) |
| セキュリティ: 認証・認可                   | ✅       | [SECURITY_MEASURES.md](./SECURITY_MEASURES.md)             |
| セキュリティ: 電子署名・タイムスタンプ     | ✅       | [SECURITY_MEASURES.md](./SECURITY_MEASURES.md)             |
| セキュリティ: 証跡のレビュー・システム監査 | ✅       | [SECURITY_MEASURES.md](./SECURITY_MEASURES.md)             |
| セキュリティ: 外部からの攻撃対策           | ✅       | [SECURITY_MEASURES.md](./SECURITY_MEASURES.md)             |

## 注意事項

- 監査ログは改ざん防止のためチェックサムを記録
- 更新履歴は削除されません（ガイドライン準拠）
- 代行操作は必ず承認が必要です
- すべての文書は定期的に更新が必要です（DOCUMENTATION_MANAGEMENT.mdを参照）
- 外部サービスとの責任分界は定期的に見直しが必要です（RESPONSIBILITY_DEMARCATION.mdを参照）
