# 法制度等による要求事項への対応

本システムは、厚生労働省の「医療情報システムの安全管理に関するガイドライン第6.0版」の「1.1 安全管理に関する法制度等による要求事項」に準拠するよう実装されています。

## 実装済みの法的要件対応

### 1. 個人情報保護法における安全管理措置

#### ✅ 個人情報の暗号化

- **実装**: `src/lib/security/encryption.ts`
- **方式**: AES-256-GCM（認証付き暗号）
- **対象**: 電話番号、メールアドレス、住所、保険証番号（オプション）
- **環境変数**: `PERSONAL_INFO_ENCRYPTION_KEY`（64文字のHEX鍵）

#### ✅ アクセスログの記録

- **実装**: `src/lib/security/access-log.ts`
- **記録内容**:
  - アクセス者（ユーザーID）
  - アクセス日時
  - アクセス対象（患者ID、記録ID等）
  - IPアドレス、ユーザーエージェント
- **記録タイミング**: 個人情報の閲覧・更新時

#### ✅ アクセス制御

- ロールベースアクセス制御（ADMIN, PRACTITIONER, RECEPTION）
- 認証必須のAPIエンドポイント
- セッション管理（JWT）

### 2. e-文書法に関する対応

#### ✅ 電子署名

- **実装**: `src/lib/security/digital-signature.ts`
- **方式**: HMAC-SHA256（開発環境）
- **本番環境推奨**: 認証局（CA）発行の証明書を使用
- **対象**: 確定済み施術記録

#### ✅ タイムスタンプ

- **実装**: `src/lib/security/digital-signature.ts`
- **方式**: システムタイムスタンプ（開発環境）
- **本番環境推奨**: タイムスタンプ局（TSA）のサービスを使用
- **記録内容**:
  - タイムスタンプ（ISO 8601形式）
  - タイムスタンプハッシュ（SHA-256）
  - タイムスタンプソース（SYSTEM/TSA）

#### ✅ 改ざん検出

- 電子署名による改ざん検出
- タイムスタンプハッシュによる検証
- 検証API: `/api/treatment-records/[id]/verify`

### 3. 施術記録への電子署名・タイムスタンプ

#### ✅ 確定時の自動付与

- 施術記録確定時（`/api/treatment-records/[id]/confirm`）に自動的に電子署名とタイムスタンプを付与
- 記録内容のハッシュ値を計算
- 電子署名を生成
- タイムスタンプを生成

## 実装ファイル

### セキュリティ機能

- `src/lib/security/encryption.ts`: 個人情報の暗号化
- `src/lib/security/digital-signature.ts`: 電子署名・タイムスタンプ
- `src/lib/security/access-log.ts`: アクセスログ記録

### APIエンドポイント

- `POST /api/treatment-records/[id]/confirm`: 記録確定（電子署名・タイムスタンプ付与）
- `GET /api/treatment-records/[id]/verify`: 電子署名検証
- `GET /api/patients/[id]`: 患者情報取得（アクセスログ記録）

### データモデル

- `TreatmentRecord`: `digitalSignature`, `timestampHash`, `timestampSource` フィールド追加

## 環境変数設定

```env
# 個人情報暗号化鍵（64文字のHEX、必須）
PERSONAL_INFO_ENCRYPTION_KEY="your-64-char-hex-key-here"

# 電子署名用秘密鍵（本番環境では認証局発行の証明書を使用）
SIGNING_PRIVATE_KEY="your-signing-key-here"
```

## 本番環境での推奨事項

### 1. 電子署名

- 認証局（CA）発行の証明書を使用
- 公開鍵基盤（PKI）の導入を検討

### 2. タイムスタンプ

- タイムスタンプ局（TSA）のサービスを使用
- RFC 3161準拠のタイムスタンプトークンを取得

### 3. 暗号化鍵管理

- 鍵の安全な保管（HSM等の使用を検討）
- 定期的な鍵ローテーション

## 参考資料

- [医療情報システムの安全管理に関するガイドライン第6.0版](https://www.mhlw.go.jp/content/10808000/001582980.pdf)
- [個人情報の保護に関する法律](https://www.ppc.go.jp/personalinfo/)
- [e-文書法](https://www.meti.go.jp/policy/it_policy/ebunsho/)
