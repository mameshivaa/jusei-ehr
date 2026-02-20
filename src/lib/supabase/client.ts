import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabaseクライアント（ブラウザ用）
 * クライアントサイドでのみ使用可能
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
