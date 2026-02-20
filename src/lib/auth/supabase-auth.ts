import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logLogin } from "@/lib/activity-log";

/**
 * Supabase Auth認証設定
 * Google OAuth認証を使用してSupabase Authで認証し、
 * ローカルDBのUserテーブルと同期する
 */

/**
 * Supabase認証後のユーザー同期処理
 * 初回ログイン時にローカルDBのUserテーブルにユーザーを作成または更新
 */
export async function syncUserWithSupabase(
  supabaseUserId: string,
  email: string,
  name: string | null,
  image: string | null,
) {
  // 既存ユーザーをemailまたはsupabaseUserIdで検索
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { supabaseUserId }],
    },
  });

  if (existingUser) {
    // 既存ユーザーを更新（supabaseUserIdを設定）
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        supabaseUserId,
        email,
        name: name || existingUser.name,
        image: image || existingUser.image,
        lastLoginAt: new Date(),
      },
    });

    // ログインイベントを記録
    await logLogin(supabaseUserId, { email });

    return updatedUser;
  } else {
    // 新規ユーザーを作成（デフォルトはADMINロール）
    const newUser = await prisma.user.create({
      data: {
        supabaseUserId,
        email,
        name: name || "ユーザー",
        role: "ADMIN",
        image,
        lastLoginAt: new Date(),
      },
    });

    // ログインイベントを記録
    await logLogin(supabaseUserId, { email, is_new_user: true });

    return newUser;
  }
}

/**
 * Supabaseセッションからユーザー情報を取得
 */
export async function getUserFromSupabaseSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { user } = session;

  // ローカルDBからユーザー情報を取得
  const localUser = await prisma.user.findFirst({
    where: {
      OR: [{ supabaseUserId: user.id }, { email: user.email || "" }],
    },
  });

  if (!localUser) {
    // ユーザーが存在しない場合は同期処理を実行
    if (user.email) {
      return await syncUserWithSupabase(
        user.id,
        user.email,
        user.user_metadata?.full_name || user.user_metadata?.name || null,
        user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      );
    }
    return null;
  }

  return localUser;
}

/**
 * Supabase JWTトークンを検証
 */
export async function verifySupabaseToken(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}
