/**
 * ライセンス検証テストスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/test-license.ts
 *
 * テスト内容:
 *   1. オフライン猶予期間の計算
 *   2. ライセンス期限切れの判定
 *   3. キャッシュの有効期限判定
 */

const OFFLINE_GRACE_PERIOD_DAYS = 14;

function isWithinGracePeriod(lastVerifiedAt: string): boolean {
  const last = new Date(lastVerifiedAt);
  if (isNaN(last.getTime())) return false;
  const now = new Date();
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= OFFLINE_GRACE_PERIOD_DAYS;
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt);
  return !isNaN(exp.getTime()) && exp.getTime() < Date.now();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function runTests() {
  console.log("=== ライセンス検証テスト ===\n");
  let allPassed = true;

  // テスト1: オフライン猶予期間
  console.log("Test 1: オフライン猶予期間（14日）");
  const gracePeriodTests = [
    { days: 0, expected: true, desc: "今日検証" },
    { days: 7, expected: true, desc: "7日前検証" },
    { days: 13, expected: true, desc: "13日前検証" },
    { days: 14, expected: true, desc: "14日前検証（境界）" },
    { days: 15, expected: false, desc: "15日前検証（期限切れ）" },
    { days: 30, expected: false, desc: "30日前検証" },
  ];

  for (const { days, expected, desc } of gracePeriodTests) {
    const result = isWithinGracePeriod(daysAgo(days));
    const passed = result === expected;
    console.log(
      `  ${desc}: ${passed ? "✅" : "❌"} (result=${result}, expected=${expected})`,
    );
    if (!passed) allPassed = false;
  }
  console.log();

  // テスト2: ライセンス期限切れ判定
  console.log("Test 2: ライセンス期限切れ判定");
  const expiryTests = [
    { expiresAt: undefined, expected: false, desc: "期限なし（無期限）" },
    { expiresAt: daysFromNow(30), expected: false, desc: "30日後期限" },
    { expiresAt: daysFromNow(1), expected: false, desc: "明日期限" },
    {
      expiresAt: daysFromNow(0),
      expected: false,
      desc: "今日期限（まだ有効）",
    },
    { expiresAt: daysAgo(1), expected: true, desc: "昨日期限切れ" },
    { expiresAt: daysAgo(30), expected: true, desc: "30日前期限切れ" },
  ];

  for (const { expiresAt, expected, desc } of expiryTests) {
    const result = isExpired(expiresAt);
    const passed = result === expected;
    console.log(
      `  ${desc}: ${passed ? "✅" : "❌"} (result=${result}, expected=${expected})`,
    );
    if (!passed) allPassed = false;
  }
  console.log();

  // テスト3: 無効な日付の処理
  console.log("Test 3: 無効な日付の処理");
  const invalidDateTests = [
    { value: "invalid-date", func: "isWithinGracePeriod", expected: false },
    { value: "", func: "isWithinGracePeriod", expected: false },
    { value: "invalid-date", func: "isExpired", expected: false },
  ];

  for (const { value, func, expected } of invalidDateTests) {
    const result =
      func === "isWithinGracePeriod"
        ? isWithinGracePeriod(value)
        : isExpired(value);
    const passed = result === expected;
    console.log(
      `  ${func}("${value}"): ${passed ? "✅" : "❌"} (result=${result})`,
    );
    if (!passed) allPassed = false;
  }
  console.log();

  // テスト4: ライセンス状態シナリオ
  console.log("Test 4: ライセンス状態シナリオ");

  interface LicenseCache {
    status: "valid" | "expired" | "grace_period";
    lastVerifiedAt: string;
    expiresAt?: string;
  }

  function checkLicenseStatus(
    cache: LicenseCache,
  ): "allowed" | "grace_period" | "denied" {
    // まずオフライン猶予期間をチェック（14日）
    if (!isWithinGracePeriod(cache.lastVerifiedAt)) {
      return "denied";
    }

    // 猶予期間内でライセンスが有効なら許可
    if (cache.status === "valid" && !isExpired(cache.expiresAt)) {
      return "allowed";
    }

    // ライセンス自体は期限切れだが猶予期間内
    if (cache.status === "expired" || isExpired(cache.expiresAt)) {
      return "grace_period";
    }

    return "denied";
  }

  const scenarios: Array<{
    desc: string;
    cache: LicenseCache;
    expected: "allowed" | "grace_period" | "denied";
  }> = [
    {
      desc: "有効なライセンス（期限内）",
      cache: {
        status: "valid",
        lastVerifiedAt: daysAgo(1),
        expiresAt: daysFromNow(30),
      },
      expected: "allowed",
    },
    {
      desc: "有効なライセンス（期限なし）",
      cache: { status: "valid", lastVerifiedAt: daysAgo(1) },
      expected: "allowed",
    },
    {
      desc: "ライセンス期限切れ、猶予期間内",
      cache: {
        status: "expired",
        lastVerifiedAt: daysAgo(7),
        expiresAt: daysAgo(1),
      },
      expected: "grace_period",
    },
    {
      desc: "ライセンス期限切れ、猶予期間切れ",
      cache: {
        status: "expired",
        lastVerifiedAt: daysAgo(20),
        expiresAt: daysAgo(15),
      },
      expected: "denied",
    },
    {
      desc: "オフライン長期（猶予期間切れ）",
      cache: {
        status: "valid",
        lastVerifiedAt: daysAgo(20),
        expiresAt: daysFromNow(30),
      },
      expected: "denied",
    },
  ];

  for (const { desc, cache, expected } of scenarios) {
    const result = checkLicenseStatus(cache);
    const passed = result === expected;
    console.log(
      `  ${desc}: ${passed ? "✅" : "❌"} (result=${result}, expected=${expected})`,
    );
    if (!passed) allPassed = false;
  }
  console.log();

  console.log("=== 総合結果 ===");
  console.log(allPassed ? "✅ 全テスト合格" : "❌ 一部テスト失敗");
  return allPassed;
}

const success = runTests();
process.exit(success ? 0 : 1);
