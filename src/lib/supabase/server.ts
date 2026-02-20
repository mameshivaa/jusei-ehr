import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabaseクライアント（サーバー用）
 * Server Components、Server Actions、Route Handlersで使用可能
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Server Componentから呼ばれた場合は無視
            // Route Handlerから呼ばれた場合のみ設定可能
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // Server Componentから呼ばれた場合は無視
            // Route Handlerから呼ばれた場合のみ設定可能
          }
        },
      },
    },
  );
}

/**
 * Supabaseクライアント（サービスロール用）
 * 管理者権限が必要な操作で使用（例: ユーザー管理、監査関連処理）
 *
 * 注意: @supabase/ssr の createServerClient はサービスロールキーには適していません。
 * cookie ベースのセッション管理により、ユーザーセッションが優先され、サービスロールの権限が失われます。
 * そのため、@supabase/supabase-js の createClient を直接使用します。
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Please set it in your environment variables.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Please set it in your environment variables.",
    );
  }

  // 空文字列や明らかに無効な値のチェック
  if (serviceRoleKey.trim().length === 0) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is empty. Please set a valid service role key in your environment variables.",
    );
  }

  // プレースホルダー値のチェック
  if (
    serviceRoleKey.includes("your-service-role-key") ||
    serviceRoleKey.includes("change-in-production") ||
    serviceRoleKey === "dev-service-role-key"
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY appears to be a placeholder value. Please set the actual service role key from your Supabase project settings.",
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
