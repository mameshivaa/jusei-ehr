import { NextResponse } from "next/server";
import { isSetupComplete } from "@/lib/setup/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const complete = await isSetupComplete();
  return NextResponse.json({ isSetupComplete: complete });
}
