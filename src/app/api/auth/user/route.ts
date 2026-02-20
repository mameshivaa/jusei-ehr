import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * 現在のユーザー情報を取得するAPI
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error getting user:", error);
    return NextResponse.json(
      { error: "ユーザー情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
