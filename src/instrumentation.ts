/**
 * Next.js Instrumentation Hook
 * サーバー起動時に実行される
 */
export async function register() {
  // サーバーサイドでのみ実行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installRuntimeLogCapture } = await import(
      "./lib/logging/runtime-log-capture"
    );
    installRuntimeLogCapture();
  }
}
