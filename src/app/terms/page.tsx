import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="rounded-lg border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">利用規約</h1>

          <div className="prose prose-slate max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                1. はじめに
              </h2>
              <p className="text-slate-700">
                本利用規約は、柔道整復施術所向け電子施術録（以下「本アプリ」）に適用される利用条件を定めるものです。
                配布者は田島京志郎です。本アプリをインストールまたは使用することで、本規約に同意したものとみなされます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                2. サービスの提供
              </h2>
              <p className="text-slate-700">
                本アプリは Electron
                アプリとして提供されます。無償提供のため、配布者は予告なく提供を終了できるものとします。
                また、更新の提供を保証するものではありません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                3. 禁止行為
              </h2>
              <p className="text-slate-700">
                利用者は、以下の行為を行ってはなりません。
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-1">
                <li>本アプリの再配布、転売、レンタル</li>
                <li>本アプリの改変</li>
                <li>
                  本アプリのリバースエンジニアリング（法令で認められる範囲を除く）
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                4. 利用者の責任
              </h2>
              <p className="text-slate-700">利用者は、以下の責任を負います。</p>
              <ul className="list-disc list-inside text-slate-700 space-y-1">
                <li>患者情報の適切な管理とセキュリティ対策</li>
                <li>データのバックアップおよびデータ復旧</li>
                <li>法令遵守（個人情報保護法、医療法等）</li>
                <li>本アプリの適切な使用</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                5. 知的財産権
              </h2>
              <p className="text-slate-700">
                本アプリおよび同梱物の知的財産権は配布者に帰属します。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                6. 情報の取扱い
              </h2>
              <p className="text-slate-700">
                本アプリは初回セットアップ時に責任者情報を端末内に保存します。利用者データは端末内で管理され、外部サービスへ自動送信されません。
                詳細は{" "}
                <Link
                  href="/privacy"
                  className="text-slate-600 hover:underline"
                >
                  プライバシーポリシー
                </Link>{" "}
                を参照してください。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                7. 医療情報システム
              </h2>
              <p className="text-slate-700">
                本アプリは「医療情報システムの安全管理に関するガイドライン」に準拠することを前提として設計されています。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                8. 免責事項
              </h2>
              <p className="text-slate-700">
                本アプリは「現状のまま」提供され、以下の事項について一切の責任を負いません。
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-1">
                <li>データの損失、破損、漏洩</li>
                <li>システムの不具合や障害</li>
                <li>利用者による不適切な使用に起因する損害</li>
                <li>本アプリを使用したことによる直接的・間接的な損害</li>
                <li>医療行為・診療記録の正確性に関する事項</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                9. システム障害時の対応
              </h2>
              <p className="text-slate-700">
                システム障害時は配布者に連絡できますが、対応を保証するものではありません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                10. 契約の終了
              </h2>
              <p className="text-slate-700">
                利用者はいつでも利用を停止できます。配布者は予告なく提供を終了できます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                11. 準拠法
              </h2>
              <p className="text-slate-700">本規約は日本法に準拠します。</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                12. 規約の変更
              </h2>
              <p className="text-slate-700">
                本規約は、予告なく変更される場合があります。変更内容は本ページで公開されます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900">
                13. お問い合わせ
              </h2>
              <p className="text-slate-700">
                本規約に関するお問い合わせは、配布者（田島京志郎）宛にご連絡ください。
                <br />
                vcharte378@gmail.com
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
