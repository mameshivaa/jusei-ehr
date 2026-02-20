import { NextResponse } from "next/server";
import { getBoundGoogleAccount } from "@/lib/auth/google-binding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const boundEmail = await getBoundGoogleAccount();
  return NextResponse.json({ boundEmail });
}
