/**
 * macOS Notarization Script
 * Apple公証サービスを使用してアプリを公証
 *
 * 必要な環境変数:
 * - APPLE_KEYCHAIN_PROFILE: notarytool keychain profile name (推奨)
 * - APPLE_API_KEY_PATH: .p8の絶対パス（keychain未使用時）
 * - APPLE_API_KEY_ID: Key ID
 * - APPLE_API_ISSUER: Issuer ID
 * - APPLE_ID: Apple Developer ID（旧方式）
 * - APPLE_ID_PASSWORD: アプリ固有パスワード（旧方式）
 * - APPLE_TEAM_ID: チームID（旧方式）
 */

const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // macOS以外はスキップ
  if (electronPlatformName !== "darwin") {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appBundleId = context.packager.appInfo.id;

  console.log(`Notarizing ${appName}...`);

  try {
    const appPath = `${appOutDir}/${appName}.app`;
    const keychainProfile = process.env.APPLE_KEYCHAIN_PROFILE;
    const apiKeyPath = process.env.APPLE_API_KEY_PATH;
    const apiKeyId = process.env.APPLE_API_KEY_ID;
    const apiIssuer = process.env.APPLE_API_ISSUER;

    if (keychainProfile) {
      await notarize({
        appBundleId,
        appPath,
        keychainProfile,
      });
    } else if (apiKeyPath && apiKeyId && apiIssuer) {
      await notarize({
        appBundleId,
        appPath,
        appleApiKey: apiKeyPath,
        appleApiKeyId: apiKeyId,
        appleApiIssuer: apiIssuer,
      });
    } else if (
      process.env.APPLE_ID &&
      process.env.APPLE_ID_PASSWORD &&
      process.env.APPLE_TEAM_ID
    ) {
      await notarize({
        appBundleId,
        appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      });
    } else {
      console.log("Skipping notarization: Missing Apple credentials");
      return;
    }

    console.log("Notarization complete!");
  } catch (error) {
    console.error("Notarization failed:", error);
    throw error;
  }
};
