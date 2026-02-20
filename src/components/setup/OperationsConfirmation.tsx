"use client";

import { useRef, useEffect, useState } from "react";

interface OperationsConfirmationProps {
  onConfirmedChange: (confirmed: boolean) => void;
  invalid?: boolean;
}

export function OperationsConfirmation({
  onConfirmedChange,
  invalid = false,
}: OperationsConfirmationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (atBottom) {
        setReady(true);
      } else {
        setReady(false);
      }
    };

    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    onConfirmedChange(ready);
  }, [ready, onConfirmedChange]);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          運用体制の内容を確認し、実施することを確認してください。
        </p>
        <div className="border-t border-slate-200" />
        <div className="pt-1">
          <div className="relative">
            <div
              ref={containerRef}
              className={`h-[332px] overflow-y-auto rounded-md px-4 py-3 text-sm text-slate-700 space-y-6 border ${
                invalid
                  ? "border-red-500 bg-red-50/40"
                  : "border-slate-200 bg-white"
              }`}
            >
              <section>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  1. 連絡体制（ガイドライン 3.3.2、11.2 参照）
                </h3>
                <p className="mb-3">
                  <strong>実施すべき事項：</strong>
                  インシデント発生時に連絡する相手（院内・関係機関）と手順を決定し、文書化してください。ローカル運用でインターネット接続が不要な場合の連絡手段も含めて決定してください。
                </p>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  院内連絡先（接骨院内）
                </h4>
                <p className="mb-2">
                  以下の連絡先リストを作成し、分かりやすい場所に保管してください。
                </p>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    安全管理責任者（運用の最終責任者）：役職・氏名・連絡先（電話番号、メールアドレス）
                  </li>
                  <li>
                    システム管理者（バックアップ・復旧の実施者）：役職・氏名・連絡先
                  </li>
                  <li>
                    技術責任者（技術的な問題の一次窓口）：役職・氏名・連絡先
                  </li>
                </ul>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">連絡先リスト（例）</p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【安全管理責任者】
役職：院長
氏名：山田 太郎
電話：090-1234-5678
メール：yamada@example.com

【システム管理者】
役職：事務長
氏名：佐藤 花子
電話：090-2345-6789
メール：sato@example.com

【技術責任者】
役職：柔道整復師
氏名：鈴木 一郎
電話：090-3456-7890
メール：suzuki@example.com`}
                  </pre>
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  連絡順序とエスカレーション手順
                </h4>
                <p className="mb-2">
                  インシデント発生時の連絡の流れを明確化してください。
                </p>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">連絡手順（例）</p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【レベル1：軽微】
→ システム管理者に連絡
→ 記録を残す

【レベル2：中程度】
→ システム管理者に連絡
→ 解決しない場合、安全管理責任者にエスカレーション

【レベル3：重大】
→ 安全管理責任者と技術責任者に同時連絡
→ 記録を詳細に残す

【レベル4：緊急】
→ 全責任者に同時連絡
→ 記録を詳細に残す`}
                  </pre>
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  責任分界の明確化
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    接骨院の責任範囲：ローカルシステムの運用、電子施術録データ管理
                  </li>
                  <li>
                    外部サービス提供者の責任範囲：認証基盤など外部連携機能の可用性管理
                  </li>
                  <li>
                    連絡が必要な状況の定義：システム障害、データ破損、セキュリティインシデント
                  </li>
                </ul>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  ローカル運用の特性
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    インターネット接続が不要な場合の連絡手段：電話、直接訪問
                  </li>
                  <li>
                    オフライン時の対応手順：連絡記録をローカル保存、記録媒体への記録
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  2. バックアップと復旧（ガイドライン 12.2 参照）
                </h3>
                <p className="mb-3">
                  <strong>実施すべき事項：</strong>
                  バックアップの実施方法、頻度、保存場所、復旧手順、RTO/RPOを決定し、実施してください。ローカル運用を前提に、1PC運用での特性を反映した計画を立ててください。
                </p>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  バックアップの実施方法（ローカル運用）
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    バックアップの頻度：日次推奨（業務終了後など）。最低限、週に1回は実施してください。
                  </li>
                  <li>
                    バックアップの種類：完全バックアップ、差分バックアップ
                  </li>
                  <li>
                    バックアップの保存場所：同一PC内の別ディレクトリ（例：C:\v-oss\backups\）、外部ストレージ/USBメモリ
                  </li>
                  <li>
                    バックアップの暗号化とアクセス制御：ファイルシステムレベル、暗号化ソフトウェア
                  </li>
                  <li>
                    オフライン運用でのバックアップ手順：手動バックアップ、自動バックアップスクリプト（設定済みの場合）
                  </li>
                </ul>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">バックアップ保存場所（例）</p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【ローカル保存】
場所：C:\\v-oss\\backups\\
ファイル名：dev.db.YYYYMMDD_HHMMSS

【外部ストレージ】
媒体：USBメモリ（32GB以上推奨）
保管場所：事務所の金庫または別の部屋`}
                  </pre>
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  バックアップ手順
                </h4>
                <p className="mb-2">
                  誰でも実行できるように手順を明確化してください。
                </p>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">バックアップ手順（例）</p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【手動バックアップ】
1. システムを停止（必要に応じて）
2. データベースファイルをコピー
   - コピー元：C:\\v-oss\\prisma\\dev.db
   - コピー先：C:\\v-oss\\backups\\dev.db.YYYYMMDD_HHMMSS
3. 外部ストレージにもコピー
4. バックアップファイルの整合性を確認`}
                  </pre>
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  復旧手順
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    復旧手順の文書化：手順書の保管場所を明記（紙 / ローカル）
                  </li>
                  <li>復旧テストの実施頻度：四半期推奨</li>
                  <li>
                    復旧時間目標（RTO）の設定：接骨院の業務継続に必要な時間（例：2時間以内）
                  </li>
                  <li>
                    復旧ポイント目標（RPO）の設定：許容できるデータ損失の範囲（例：前日のバックアップまで）
                  </li>
                  <li>1PC運用での復旧手順：データベースファイルの置き換え</li>
                </ul>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">復旧手順（例）</p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【復旧手順】
1. システムを停止
2. 現在のデータベースファイルをバックアップ（証拠保全）
3. バックアップファイルを復元
   - 復元元：C:\\v-oss\\backups\\dev.db.YYYYMMDD_HHMMSS
   - 復元先：C:\\v-oss\\prisma\\dev.db
4. データベースの整合性を確認
5. システムを再起動
6. データが正常に表示されることを確認

【復旧目標】
- RTO（復旧時間目標）：2時間以内
- RPO（復旧ポイント目標）：前日のバックアップまで`}
                  </pre>
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  バックアップの管理
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>バックアップの整合性確認：定期的な検証（月に1回推奨）</li>
                  <li>
                    古いバックアップの管理：保存期間（最低3ヶ月、推奨1年）、削除手順
                  </li>
                  <li>
                    バックアップ媒体の経年変化対策：USBメモリは2-3年、外付けHDDは3-5年で定期交換
                  </li>
                  <li>
                    外部ストレージへのバックアップ：別の物理的な場所への保管
                  </li>
                </ul>
                <p className="mb-3">
                  例：3ヶ月以上経過したバックアップは、新しいバックアップで上書きするか削除。USBメモリは2年に1回交換。
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  3. BCP（業務継続計画）（ガイドライン 11.2 参照）
                </h3>
                <p className="mb-3">
                  <strong>実施すべき事項：</strong>
                  災害やサイバー攻撃を想定した業務継続計画を策定し、文書化してください。ローカル運用での特性を反映した計画を立ててください。
                </p>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  災害時の対応（ローカル運用）
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>自然災害時の対応手順：停電、水害、地震等</li>
                  <li>システム停止時の代替手段：紙運用、暫定記録</li>
                  <li>データ復旧の優先順位：患者情報、施術記録、来院記録</li>
                  <li>
                    PC機器の故障時の対応：バックアップからの復旧、代替PCへの移行
                  </li>
                  <li>
                    オフライン運用でのBCP：インターネット接続が不要なため、外部サービス障害の影響が限定的
                  </li>
                </ul>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">災害時対応手順（例）</p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【停電時】
1. UPSでシステムを安全に停止
2. 紙の施術記録・来院記録に切り替え
3. 復旧後、紙の記録をシステムに入力

【水害・地震時】
1. PC機器を安全な場所に移動（可能な場合）
2. バックアップ媒体を確認
3. システムが使用できない場合、紙運用に切り替え
4. 復旧後、バックアップからデータを復元

【データ復旧の優先順位】
1. 患者基本情報
2. 施術記録
3. 来院記録`}
                  </pre>
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  サイバー攻撃時の対応
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    攻撃検知時の初動対応：マルウェア検知、不正アクセス検知
                  </li>
                  <li>
                    システムの隔離手順：ネットワーク切断、外部ストレージの切断
                  </li>
                  <li>
                    影響範囲の特定方法：監査ログの確認、データベースの整合性チェック
                  </li>
                  <li>
                    復旧後の再発防止策：セキュリティ設定の見直し、スタッフ教育
                  </li>
                </ul>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">
                    サイバー攻撃時対応手順（例）
                  </p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【初動対応】
1. システムを即座に停止
2. ネットワーク接続を切断（可能な場合）
3. 外部ストレージを切断
4. 安全管理責任者に連絡

【影響範囲の特定】
1. 監査ログを確認
2. データベースの整合性をチェック
3. 異常な操作パターンを特定

【復旧】
1. クリーンな環境でシステムを再起動
2. バックアップからデータを復元
3. セキュリティ設定を見直し
4. スタッフに再発防止策を周知`}
                  </pre>
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  業務継続のための代替手段
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    代替システムの準備：別PCへの移行、クラウドバックアップからの復旧
                  </li>
                  <li>手動運用への切り替え手順：紙の施術記録、来院記録</li>
                  <li>
                    業務継続時間目標（BCP目標時間）：接骨院の営業継続に必要な時間
                  </li>
                  <li>
                    1PC運用でのリスク（単一障害点）と対策：定期的なバックアップ、代替PCの準備
                  </li>
                </ul>
                <p className="mb-3">
                  例：システムが2時間以上停止する場合、紙の施術記録・来院記録に切り替え。復旧後、紙の記録をシステムに入力。1PC運用では、PC故障が業務全体に影響します。定期的なバックアップと、可能であれば代替PCの準備を推奨します。
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  4. アクセスログ（ガイドライン 11.1 参照）
                </h3>
                <p className="mb-3">
                  <strong>実施すべき事項：</strong>
                  ログの保存期間、確認頻度、エクスポート方法を決定し、定期的に確認を実施してください。1PC複数スタッフ運用を前提にします。
                </p>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  ログの記録内容（1PC複数スタッフ運用）
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    監査ログ：すべての重要操作（CREATE/UPDATE/DELETE/VERIFY/LOGIN等）
                  </li>
                  <li>
                    アクセスログ：個人情報への閲覧・エクスポート（誰が、いつ、どの患者情報にアクセスしたか）
                  </li>
                  <li>
                    ログイン試行ログ：認証成功/失敗、MFA要求（複数スタッフのログイン履歴）
                  </li>
                  <li>緊急操作ログ：LOCK_ALL/UNLOCK_ALL等</li>
                  <li>
                    スタッフ別の操作履歴：柔道整復師、受付等の役割別の操作記録
                  </li>
                </ul>
                <p className="mb-3">
                  システムは、すべての重要な操作を自動的に記録します。設定画面の「監査ログ」から確認できます。
                </p>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  ログの保存期間
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>監査ログ：365日（接骨院の規程に応じて1-3年）</li>
                  <li>アクセスログ：365日</li>
                  <li>ログイン試行ログ：365日</li>
                  <li>緊急操作ログ：3年推奨</li>
                </ul>
                <p className="mb-3">
                  ログの保存期間は、接骨院の規程や法的要件に応じて設定してください。システム設定画面で変更可能です。
                </p>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  ログの確認方法（ローカル運用）
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>ログの定期確認頻度：週次推奨</li>
                  <li>
                    異常な操作パターンの検知方法：不正アクセス、不審な操作の検知
                  </li>
                  <li>
                    ログのエクスポートと保管方法：ローカルファイルへのエクスポート、外部ストレージへの保管
                  </li>
                  <li>
                    1PC運用でのログ管理：データベース内のログテーブル、定期的なエクスポート
                  </li>
                </ul>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">
                    ログ確認チェックリスト（例）
                  </p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【週次確認項目】
□ 異常なログイン試行がないか
□ 不審な操作パターンがないか
□ 個人情報への不適切なアクセスがないか
□ 緊急操作が適切に記録されているか

【確認方法】
1. 設定画面の「監査ログ」にアクセス
2. 過去1週間のログを確認
3. 異常があれば安全管理責任者に報告`}
                  </pre>
                </div>
                <p className="mb-3">
                  ログは定期的にエクスポートし、外部ストレージに保管してください。システム設定画面の「監査ログ」からエクスポートできます。エクスポート頻度は月に1回推奨です。
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  5. 運用管理規程（ガイドライン 2.1 参照）
                </h3>
                <p className="mb-3">
                  <strong>実施すべき事項：</strong>
                  運用上のルールを文書化し、責任者を明確化し、見直しプロセスを決定してください。接骨院向けの内容です。
                </p>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  運用規程の文書化（接骨院向け）
                </h4>
                <p className="mb-2">以下の文書類を作成してください。</p>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    運用マニュアル：電子施術録の日常的な操作方法（システムの起動・停止、データベースの確認、ログの確認方法など）
                  </li>
                  <li>
                    非常時対応手順：システム障害、災害時の対応（システムが起動しない場合、データが表示されない場合、認証エラーが発生する場合の対応手順）
                  </li>
                  <li>
                    セキュリティインシデント対応手順：不正アクセス、データ漏洩時の対応（インシデントの検知、初動対応、影響範囲の特定、復旧手順）
                  </li>
                  <li>
                    責任分界書：外部サービスとの責任分界（接骨院の責任範囲、外部サービス提供者の責任範囲、連絡が必要な状況の定義）
                  </li>
                </ul>
                <p className="mb-3">
                  これらの文書類を作成し、印刷またはデジタルファイルで保管してください。規程は、システム管理者と安全管理責任者がアクセスできる場所に保管してください。
                </p>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  規程の保管場所とアクセス制御
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>保管場所：ローカルファイル、印刷物の保管</li>
                  <li>アクセス制御：必要なスタッフのみがアクセス可能</li>
                  <li>バックアップ：文書類もバックアップ対象に含める</li>
                </ul>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  スタッフへの周知方法
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>定期的な説明会：年次または四半期に1回</li>
                  <li>
                    マニュアルの配布：新規スタッフへの配布、更新時の再配布
                  </li>
                </ul>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  規程の見直しプロセス
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>見直しの頻度：年次推奨</li>
                  <li>
                    見直しのタイミング：システム変更時、インシデント発生後、法改正時
                  </li>
                  <li>
                    見直しの責任者と承認プロセス：安全管理責任者、院長等の承認
                  </li>
                </ul>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">規程見直しプロセス（例）</p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【定期見直し】
- 頻度：年次（毎年1月）
- 責任者：安全管理責任者
- 承認者：院長

【臨時見直し】
- タイミング：システム変更時、インシデント発生後、法改正時
- 責任者：安全管理責任者
- 承認者：院長

【見直し内容】
1. 現状の規程を確認
2. 変更が必要な項目を特定
3. 変更案を作成
4. 関係者で検討
5. 承認を得て更新`}
                  </pre>
                </div>

                <h4 className="text-sm font-semibold text-slate-900 mt-4 mb-2">
                  責任者の明確化（接骨院の組織構造）
                </h4>
                <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
                  <li>
                    安全管理責任者の役割と責任：院長、事務長等（事故対応の責任者）
                  </li>
                  <li>
                    システム管理者の役割と責任：日常的なシステム運用、バックアップ実施
                  </li>
                  <li>
                    技術責任者の役割と責任：技術的な問題の対応、外部サポートとの連絡
                  </li>
                  <li>
                    責任者の交代時の手順：引き継ぎ、権限の移譲、記録の更新
                  </li>
                  <li>
                    柔道整復師、受付スタッフの役割と責任：各スタッフの操作範囲、権限
                  </li>
                </ul>
                <div className="bg-slate-50 p-3 rounded text-xs mb-3">
                  <p className="font-medium mb-2">責任者一覧（例）</p>
                  <pre className="whitespace-pre-wrap text-xs">
                    {`【安全管理責任者】
役職：院長
氏名：山田 太郎
責任：事故対応の最終責任者、規程の承認

【システム管理者】
役職：事務長
氏名：佐藤 花子
責任：日常的なシステム運用、バックアップ実施

【技術責任者】
役職：柔道整復師
氏名：鈴木 一郎
責任：技術的な問題の対応、外部サポートとの連絡

【スタッフの役割】
- 柔道整復師：施術記録の作成・編集・確定
- 受付スタッフ：来院記録の登録、患者情報の閲覧`}
                  </pre>
                </div>
              </section>

              <div className="mt-6 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-600">
                  本ドキュメントは、厚生労働省「医療情報システムの安全管理に関するガイドライン第6.0版」に準拠しています。
                </p>
              </div>
            </div>
            {/* スクロール可能であることを示す視覚的なヒント */}
            {!ready && (
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none flex items-end justify-center pb-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <svg
                    className="w-4 h-4 animate-bounce"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  <span>スクロールして続きを読む</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {!ready && (
            <p className="text-xs text-slate-500">
              最後までスクロールすると、自動的にチェックが有効になります。
            </p>
          )}
          {ready && (
            <p className="text-xs text-slate-600 font-medium">
              ✓ 最後まで読み終わりました
            </p>
          )}
          <label
            className={`flex items-start gap-3 text-sm text-slate-700 ${
              invalid
                ? "bg-red-50/40 border border-red-200 rounded-md px-2 py-1"
                : ""
            }`}
          >
            <input
              type="checkbox"
              checked={ready}
              onChange={(e) => {
                // チェックボックスはスクロール状態に連動
                if (e.target.checked && !ready) {
                  // スクロールを最下部に移動
                  if (containerRef.current) {
                    containerRef.current.scrollTop =
                      containerRef.current.scrollHeight;
                  }
                }
              }}
              disabled={!ready}
              className={`form-checkbox mt-1 disabled:opacity-50 ${invalid ? "border-red-500" : ""}`}
            />
            <span>
              <span className="block font-medium text-slate-800">
                運用体制の内容を読み、実施することを確認しました
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
