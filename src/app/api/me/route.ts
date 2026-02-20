import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (e) {
    if (e instanceof Error && (e as any).code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    if (e instanceof Error && (e as any).code === "FORBIDDEN") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "failed to fetch current user" },
      { status: 500 },
    );
  }
}
