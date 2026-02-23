# V-OSS Current Overview

最終更新: 2026-02-13

この文書は、現在の実装（`src/`, `prisma/`, `electron/`）を基準にした概要です。

全体索引は `docs/current/MASTER_INDEX.md` を参照してください。

## プロダクトの現在地

- ローカル1端末運用を前提とした接骨院向けアプリ
- Next.js App Router + Prisma + SQLite を中心に構成
- Electron ランタイムでデスクトップ配布に対応
- 認証はローカルID/パスワードセッション方式が主系
- 監査ログ、バックアップ、システムモード（READ_ONLY/MAINTENANCE）を実装

## 技術スタック（実装準拠）

- Frontend/Backend: Next.js 14 + React 18 + TypeScript
- Database: SQLite
- ORM: Prisma
- Desktop: Electron
- Validation: Zod

## 主要な業務ドメイン

- 患者管理（Patients）
- カルテ管理（Charts）
- 来院管理（Visits）
- 施術記録（Treatment Records）
- 負傷管理（Injuries）
- 文書管理（Scanned Documents）
- 監査・運用（Audit/Backup/System Mode）

## 認証・権限の要点

- `requireAuth`, `requireRole`, `requireAnyRole` によるサーバ側ガード
- ユーザーロール: `ADMIN`, `PRACTITIONER`, `RECEPTION`
- ローカルセッションCookieを用いた認証維持
- MFA関連APIあり

## スコープ上の注意

- 既存READMEに「クラウド同期は source-available 公開版のスコープ外」と明記あり
- ただしコード上は将来連携を見据えた拡張基盤を保持
- 将来連携の詳細は `docs/current/EXTENSIBILITY.md` を参照
