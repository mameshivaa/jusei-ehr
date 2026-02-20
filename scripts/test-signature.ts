/**
 * 署名検証テストスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/test-signature.ts
 *
 * テスト内容:
 *   1. 正当な署名で検証成功
 *   2. 改ざんされたパッケージで検証失敗
 *   3. 不正な署名で検証失敗
 */

import crypto from "node:crypto";

// 署名生成（外部サーバーで実行する処理）
function signPackage(packageBuffer: Buffer): {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  packageHash: string;
  signature: string;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const packageHash = crypto
    .createHash("sha256")
    .update(packageBuffer)
    .digest("hex");

  const hashBuffer = Buffer.from(packageHash, "hex");
  const signature = crypto.sign(null, hashBuffer, privateKey);

  return {
    privateKey,
    publicKey,
    packageHash,
    signature: signature.toString("base64"),
  };
}

// 署名検証（アプリ側で実行する処理）
function verifyPackageIntegrity(
  packageBuffer: Buffer,
  expectedHash: string,
  signature: string,
  publicKey: crypto.KeyObject,
): { valid: boolean; error?: string } {
  // Step 1: パッケージのSHA-256ハッシュを計算
  const actualHash = crypto
    .createHash("sha256")
    .update(packageBuffer)
    .digest("hex");

  if (actualHash !== expectedHash) {
    return { valid: false, error: "hash_mismatch" };
  }

  // Step 2: ハッシュに対する署名を検証（Ed25519）
  const signatureBuffer = Buffer.from(signature, "base64");
  const hashBuffer = Buffer.from(expectedHash, "hex");

  const isValid = crypto.verify(null, hashBuffer, publicKey, signatureBuffer);

  if (!isValid) {
    return { valid: false, error: "signature_invalid" };
  }

  return { valid: true };
}

// テスト実行
function runTests() {
  console.log("=== 署名検証テスト ===\n");

  // テスト1: 正当な署名
  console.log("Test 1: 正当な署名で検証成功");
  const originalPackage = Buffer.from("これはテスト用のパッケージデータです");
  const { packageHash, signature, publicKey } = signPackage(originalPackage);
  const result1 = verifyPackageIntegrity(
    originalPackage,
    packageHash,
    signature,
    publicKey,
  );
  console.log(`  結果: ${result1.valid ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`  packageHash: ${packageHash.substring(0, 32)}...`);
  console.log(`  signature: ${signature.substring(0, 32)}...\n`);

  // テスト2: 改ざんされたパッケージ
  console.log("Test 2: 改ざんされたパッケージで検証失敗");
  const tamperedPackage = Buffer.from("これは改ざんされたパッケージデータです");
  const result2 = verifyPackageIntegrity(
    tamperedPackage,
    packageHash,
    signature,
    publicKey,
  );
  console.log(`  結果: ${!result2.valid ? "✅ 正しく拒否" : "❌ 誤って許可"}`);
  console.log(`  エラー: ${result2.error}\n`);

  // テスト3: 不正な署名
  console.log("Test 3: 不正な署名で検証失敗");
  const fakeSignature = Buffer.from("fake-signature").toString("base64");
  const result3 = verifyPackageIntegrity(
    originalPackage,
    packageHash,
    fakeSignature,
    publicKey,
  );
  console.log(`  結果: ${!result3.valid ? "✅ 正しく拒否" : "❌ 誤って許可"}`);
  console.log(`  エラー: ${result3.error}\n`);

  // テスト4: ハッシュ改ざん
  console.log("Test 4: ハッシュ改ざんで検証失敗");
  const fakeHash = "0".repeat(64);
  const result4 = verifyPackageIntegrity(
    originalPackage,
    fakeHash,
    signature,
    publicKey,
  );
  console.log(`  結果: ${!result4.valid ? "✅ 正しく拒否" : "❌ 誤って許可"}`);
  console.log(`  エラー: ${result4.error}\n`);

  // 総合結果
  const allPassed =
    result1.valid && !result2.valid && !result3.valid && !result4.valid;
  console.log("=== 総合結果 ===");
  console.log(allPassed ? "✅ 全テスト合格" : "❌ 一部テスト失敗");

  return allPassed;
}

const success = runTests();
process.exit(success ? 0 : 1);
