/**
 * 開発用認証バイパスの安全な判定
 *
 * - DEV_BYPASS_AUTH=true は開発/テスト環境のみ許可
 * - 本番環境で true が設定された場合は fail-closed で停止
 */
export function isDevBypassAuthEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const requested = env.DEV_BYPASS_AUTH === "true";
  if (!requested) return false;
  const nodeEnv = env.NODE_ENV || "production";

  if (nodeEnv === "production") {
    throw new Error(
      "Invalid configuration: DEV_BYPASS_AUTH=true is forbidden in production.",
    );
  }

  return true;
}
