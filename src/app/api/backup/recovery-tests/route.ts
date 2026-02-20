import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

const recoveryTestSchema = z.object({
  backupFileName: z.string().trim().optional(),
  backupCreatedAt: z.string().datetime().optional(),
  testStartedAt: z.string().datetime(),
  testEndedAt: z.string().datetime(),
  success: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole("ADMIN");
    const body = await request.json();
    const validated = recoveryTestSchema.parse(body);

    const testStartedAt = new Date(validated.testStartedAt);
    const testEndedAt = new Date(validated.testEndedAt);
    if (testEndedAt.getTime() < testStartedAt.getTime()) {
      return NextResponse.json(
        { error: "testEndedAt must be after testStartedAt" },
        { status: 400 },
      );
    }

    const durationMs = testEndedAt.getTime() - testStartedAt.getTime();
    const rtoSeconds = Math.floor(durationMs / 1000);

    const backupCreatedAt = validated.backupCreatedAt
      ? new Date(validated.backupCreatedAt)
      : null;
    const rpoSeconds = backupCreatedAt
      ? Math.max(
          0,
          Math.floor(
            (testStartedAt.getTime() - backupCreatedAt.getTime()) / 1000,
          ),
        )
      : null;

    const recoveryLog = await prisma.recoveryTestLog.create({
      data: {
        backupFileName: validated.backupFileName || null,
        backupCreatedAt,
        testStartedAt,
        testEndedAt,
        durationMs,
        rtoSeconds,
        rpoSeconds,
        success: validated.success,
        notes: validated.notes || null,
        performedBy: admin.id,
      },
    });

    const auditData = getAuditLogData(
      request,
      admin.id,
      "RECOVERY_TEST",
      "BACKUP",
    );
    await createAuditLog({
      ...auditData,
      action: "RECOVERY_TEST",
      entityType: "BACKUP",
      category: "SYSTEM",
      severity: validated.success ? "INFO" : "WARNING",
      metadata: {
        backupFileName: validated.backupFileName || null,
        backupCreatedAt: validated.backupCreatedAt || null,
        testStartedAt: validated.testStartedAt,
        testEndedAt: validated.testEndedAt,
        durationMs,
        rtoSeconds,
        rpoSeconds,
        success: validated.success,
      },
    });

    return NextResponse.json({ ok: true, recoveryLog });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    console.error("Recovery test log error:", error);
    return NextResponse.json(
      { error: "復旧テストログの記録に失敗しました" },
      { status: 500 },
    );
  }
}
