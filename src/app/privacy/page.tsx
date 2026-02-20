import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="rounded-lg border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">
            プライバシーポリシー
          </h1>

          <div className="prose prose-slate max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                1. はじめに
              </h2>
              <p className="text-slate-700">
                柔道整復施術所向け電子施術録（以下「本アプリ」）は、柔道整復施術所向けの電子施術録アプリです。
                本プライバシーポリシーは、本アプリにおける情報の取扱いを説明します。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                2. 配布者情報
              </h2>
              <p className="text-slate-700">
                配布者名：田島京志郎
                <br />
                連絡先：vcharte378@gmail.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                3. 個人情報の取扱いについて
              </h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-4">
                <p className="text-green-800 font-semibold">
                  ✓ 個人情報は外部送信しません
                </p>
                <p className="text-green-700 text-sm mt-2">
                  本アプリはローカル端末内で動作し、患者情報や管理情報を外部へ送信しません。
                </p>
              </div>
              <p className="text-slate-700">
                初回セットアップで入力した情報は端末内にのみ保存されます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                4. 端末内に保存される情報
              </h2>
              <p className="text-slate-700">
                本アプリは、業務に必要な情報を端末内データベースに保存します。
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-1">
                <li>患者情報・来院情報・施術記録</li>
                <li>管理者/スタッフ設定情報</li>
                <li>バックアップ設定および運用確認情報</li>
              </ul>
              <p className="text-slate-700 mt-2">
                <strong>重要</strong>
                ：患者名、電話番号、住所、診療内容などの個人を特定できる情報は端末外へ送信されません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                5. 情報の使用方法
              </h2>
              <p className="text-slate-700">
                端末内に保存された情報は以下の目的で使用されます。
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-1">
                <li>施術録管理・認証・バックアップなどの機能提供</li>
                <li>監査ログや運用記録の保持</li>
                <li>利用者自身による院内運用管理</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                6. 情報の共有
              </h2>
              <p className="text-slate-700">
                本アプリ自体が外部送信を行うことはありません。第三者提供が必要な場合は、利用者の運用判断でエクスポート等を実施してください。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                7. データの保存場所
              </h2>
              <p className="text-slate-700">
                本アプリはローカルで動作し、患者データは端末内に保存されます。配布者は患者データに直接アクセスすることはできません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                8. セキュリティ対策
              </h2>
              <p className="text-slate-700">
                本アプリでは、以下のセキュリティ対策を実施しています。
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-1">
                <li>AES-256-GCM によるデータ暗号化</li>
                <li>アクセス制御</li>
                <li>アクセスログの記録</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                9. データの保存期間
              </h2>
              <p className="text-slate-700">
                端末内データの保存期間は、利用者の運用ポリシーおよび関連法令に従って管理してください。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                10. ユーザーの権利
              </h2>
              <p className="text-slate-700">
                端末内データに対する開示・訂正・削除の対応は、利用者自身の管理責任のもとで実施されます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                11. 外部送信について
              </h2>
              <p className="text-slate-700">
                本OSS版は利用状況データの外部送信を行いません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                12. お問い合わせ
              </h2>
              <p className="text-slate-700">
                プライバシーに関するお問い合わせは、配布者（田島京志郎）宛にご連絡ください。
                <br />
                vcharte378@gmail.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                13. プライバシーポリシーの変更
              </h2>
              <p className="text-slate-700">
                本プライバシーポリシーは、予告なく変更される場合があります。変更内容は本ページで公開されます。
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <Link
              href="/"
              className="text-slate-600 hover:text-slate-900 text-sm"
            >
              ← ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
