import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  ensureGoogleAccountBinding,
  getBoundGoogleAccount,
} from "@/lib/auth/google-binding";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export async function GET(request: Request) {
  const admin = await requireRole("ADMIN");
  const email = await getBoundGoogleAccount();
  const auditData = getAuditLogData(
    request,
    admin.id,
    "READ",
    "SYSTEM_SETTINGS",
  );
  await createAuditLog({
    ...auditData,
    action: "READ",
    entityType: "SYSTEM_SETTINGS",
    category: "SYSTEM",
    metadata: {
      setting: "google_account_email",
      value: email || "",
    },
  });
  return NextResponse.json({ email });
}

export async function PUT(req: Request) {
  const admin = await requireRole("ADMIN");
  const body = await req.json();
  const email = (body.email as string | undefined)?.trim();
  const transferRequested = Boolean(body.transferRequested);

  if (!email) {
    return NextResponse.json(
      { error: "email を指定してください" },
      { status: 400 },
    );
  }

  const previousEmail = await getBoundGoogleAccount();
  const result = await ensureGoogleAccountBinding(email, { transferRequested });

  const auditData = getAuditLogData(req, admin.id, "UPDATE", "SYSTEM_SETTINGS");
  await createAuditLog({
    ...auditData,
    action: "UPDATE",
    entityType: "SYSTEM_SETTINGS",
    category: "SYSTEM",
    severity: result.status === "blocked" ? "WARNING" : "INFO",
    metadata: {
      setting: "google_account_email",
      requestedEmail: email,
      previousEmail: previousEmail || "",
      result: result.status,
      transferRequested,
    },
  });

  if (result.status === "blocked") {
    return NextResponse.json(
      {
        error: `この院の代表アカウントは ${result.boundEmail} に固定されています。交代する場合は「上書き」を有効にしてください。`,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(result);
}
