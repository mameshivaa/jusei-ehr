# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-06

### 初回公開版

このバージョンは、v-ossの初回公開版です。

#### 重要な注意事項

- **登録必須**: v-ossは無料で公開されていますが、使用には開発者側への登録が必須です
- **電子カルテガイドライン準拠**: 厚生労働省の「医療情報システムの安全管理に関するガイドライン第6.0版」に準拠しています

## [0.1.0-dev] - 2024-12-03

### Added

- 初期リリース
- SQLite データベースによるローカル完結型の電子カルテシステム
- ローカルID/パスワード認証システム
- 患者管理機能（CRUD）
  - 患者一覧・検索
  - 新規患者登録
  - 患者詳細表示
  - 患者情報編集
- 施術記録管理機能
  - SOAP形式での施術記録作成・編集
  - 楽観的ロックによる同時編集防止
- 来院記録管理
- ロールベースアクセス制御（ADMIN, PRACTITIONER, RECEPTION）
- Prisma ORM によるデータベース管理
- TypeScript による型安全性
- Tailwind CSS によるモダンなUI

[Unreleased]: https://github.com/mameshivaa/v-oss/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mameshivaa/v-oss/releases/tag/v0.1.0
