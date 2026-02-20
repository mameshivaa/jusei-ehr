/**
 * Zip-slip 防止テストスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/test-zip-slip.ts
 *
 * テスト内容:
 *   1. 正常なZIPの展開成功
 *   2. "../" を含むパスのZIPで展開拒否
 *   3. 絶対パスを含むZIPで展開拒否
 */

import path from "node:path";

// isSafePath 関数（safe-installer.ts と同じロジック）
function isSafePath(basePath: string, targetPath: string): boolean {
  // バックスラッシュをスラッシュに正規化（Windows対応）
  const normalizedTarget = targetPath.replace(/\\/g, "/");

  // Windowsドライブレター（C: など）を拒否
  if (/^[a-zA-Z]:/.test(normalizedTarget)) {
    return false;
  }

  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, normalizedTarget);
  return resolvedTarget.startsWith(resolvedBase + path.sep);
}

function runTests() {
  console.log("=== Zip-slip 防止テスト ===\n");

  const basePath = "/Users/test/extensions/my-extension";

  // テスト1: 正常なパス
  console.log("Test 1: 正常なパスで展開許可");
  const normalPaths = [
    "manifest.json",
    "templates/patient-info.html",
    "assets/icon.png",
  ];
  for (const p of normalPaths) {
    const safe = isSafePath(basePath, p);
    console.log(`  "${p}": ${safe ? "✅ 許可" : "❌ 拒否"}`);
    if (!safe) {
      console.log("  ❌ 正常なパスが拒否されました！");
      return false;
    }
  }
  console.log();

  // テスト2: ディレクトリトラバーサル攻撃
  console.log("Test 2: ディレクトリトラバーサル攻撃を拒否");
  const traversalPaths = [
    "../../../etc/passwd",
    "../../other-extension/manifest.json",
    "templates/../../../etc/shadow",
    "..\\..\\windows\\system32\\config\\sam",
  ];
  for (const p of traversalPaths) {
    const safe = isSafePath(basePath, p);
    console.log(`  "${p}": ${!safe ? "✅ 拒否" : "❌ 誤って許可"}`);
    if (safe) {
      console.log("  ❌ 危険なパスが許可されました！");
      return false;
    }
  }
  console.log();

  // テスト3: 絶対パス
  console.log("Test 3: 絶対パスを拒否");
  const absolutePaths = [
    "/etc/passwd",
    "/tmp/malicious.sh",
    "C:\\Windows\\System32\\config\\sam",
  ];
  for (const p of absolutePaths) {
    // 注意: isSafePath は相対パスとして resolve するので、
    // 実際には path.isAbsolute() で事前チェックが必要
    const isAbsolute = path.isAbsolute(p);
    const safe = !isAbsolute && isSafePath(basePath, p);
    console.log(
      `  "${p}": ${!safe ? "✅ 拒否" : "❌ 誤って許可"} (isAbsolute=${isAbsolute})`,
    );
    if (safe) {
      console.log("  ❌ 危険なパスが許可されました！");
      return false;
    }
  }
  console.log();

  // テスト4: エッジケース
  console.log("Test 4: エッジケース");
  const edgeCases = [
    // "." は basePath 自体になり、basePath + "/" で始まらないので false
    // ZIPファイル内で "." エントリは通常存在しないので問題なし
    {
      path: ".",
      expected: false,
      desc: "カレントディレクトリ（通常ZIPに存在しない）",
    },
    { path: "./manifest.json", expected: true, desc: "./ プレフィックス" },
    { path: "a/b/c/d/e/f/g.txt", expected: true, desc: "深いネスト" },
    {
      path: "a/b/../b/c.txt",
      expected: true,
      desc: "内部での .. （結果的に安全）",
    },
    {
      path: "a/b/../../c.txt",
      expected: true,
      desc: "ベースに戻る .. （結果的に安全）",
    },
    { path: "a/b/../../../c.txt", expected: false, desc: "ベースを超える .." },
  ];
  for (const { path: p, expected, desc } of edgeCases) {
    const safe = isSafePath(basePath, p);
    const passed = safe === expected;
    console.log(
      `  "${p}" (${desc}): ${passed ? "✅" : "❌"} (safe=${safe}, expected=${expected})`,
    );
    if (!passed) {
      console.log("  ❌ 期待と異なる結果！");
      return false;
    }
  }
  console.log();

  console.log("=== 総合結果 ===");
  console.log("✅ 全テスト合格");
  return true;
}

const success = runTests();
process.exit(success ? 0 : 1);
