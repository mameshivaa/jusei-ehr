import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

export const runtime = "nodejs";

const payloadSchema = z.object({
  directory: z.string().trim().min(1, "バックアップ保存先を選択してください"),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = payloadSchema.safeParse(raw);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ||
        "バックアップ保存先を選択してください";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const directory = parsed.data.directory;
    const probeFile = path.join(
      directory,
      `.v-oss-write-check-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
    );

    try {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(probeFile, "v-oss");
      await fs.unlink(probeFile);
      return NextResponse.json({ ok: true, directory });
    } catch {
      try {
        await fs.unlink(probeFile);
      } catch {
        // ignore
      }
      return NextResponse.json(
        {
          ok: false,
          error:
            "バックアップ保存先に書き込めません。アクセス可能なフォルダを選択してください。",
          directory,
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "保存先の確認に失敗しました。もう一度お試しください。",
      },
      { status: 500 },
    );
  }
}
