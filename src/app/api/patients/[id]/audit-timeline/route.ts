import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * 患者単位の監査タイムライン（ガイドライン準拠：電子カルテ1件の履歴を時系列で表示）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole("ADMIN");

    const patientId = params.id;

    // 患者の存在確認
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, name: true, kana: true, patientNumber: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "患者が見つかりません" },
        { status: 404 },
      );
    }

    // 患者に関連する全ての監査ログを取得
    const [patientLogs, visitLogs, treatmentRecordLogs] = await Promise.all([
      // 患者情報へのアクセス
      prisma.auditLog.findMany({
        where: {
          entityType: "PATIENT",
          entityId: patientId,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 来院記録（患者の来院を取得してから関連ログを取得）
      (async () => {
        const visits = await prisma.visit.findMany({
          where: { patientId },
          select: { id: true },
        });
        const visitIds = visits.map((v) => v.id);
        return prisma.auditLog.findMany({
          where: {
            entityType: "VISIT",
            entityId: { in: visitIds },
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      })(),
      // 施術記録
      (async () => {
        const visits = await prisma.visit.findMany({
          where: { patientId },
          include: {
            treatmentRecords: {
              select: { id: true },
            },
          },
        });
        const recordIds = visits.flatMap((v) =>
          v.treatmentRecords.map((r) => r.id),
        );
        return prisma.auditLog.findMany({
          where: {
            entityType: "TREATMENT_RECORD",
            entityId: { in: recordIds },
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      })(),
    ]);

    // 施術記録の変更履歴も取得
    const visits = await prisma.visit.findMany({
      where: { patientId },
      include: {
        treatmentRecords: {
          include: {
            history: {
              include: {
                changedByUser: {
                  select: { id: true, name: true, email: true, role: true },
                },
              },
              orderBy: { changedAt: "desc" },
            },
          },
        },
      },
    });

    const treatmentRecordHistory = visits.flatMap((visit) =>
      visit.treatmentRecords.flatMap((record) =>
        record.history.map((h) => ({
          id: h.id,
          type: "TREATMENT_RECORD_HISTORY",
          action: h.changeType,
          entityType: "TREATMENT_RECORD",
          entityId: h.recordId,
          timestamp: h.changedAt,
          user: h.changedByUser,
          metadata: {
            version: h.version,
            changeReason: h.changeReason,
            visitId: visit.id,
          },
        })),
      ),
    );

    // 全てのログをマージして時系列でソート
    const allLogs = [
      ...patientLogs.map((log) => ({
        id: log.id,
        type: "AUDIT_LOG",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        timestamp: log.createdAt,
        user: log.user,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        severity: log.severity,
        category: log.category,
        metadata: log.metadata,
      })),
      ...visitLogs.map((log) => ({
        id: log.id,
        type: "AUDIT_LOG",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        timestamp: log.createdAt,
        user: log.user,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        severity: log.severity,
        category: log.category,
        metadata: log.metadata,
      })),
      ...treatmentRecordLogs.map((log) => ({
        id: log.id,
        type: "AUDIT_LOG",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        timestamp: log.createdAt,
        user: log.user,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        severity: log.severity,
        category: log.category,
        metadata: log.metadata,
      })),
      ...treatmentRecordHistory,
    ].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return NextResponse.json({
      patient: {
        id: patient.id,
        name: patient.name,
        kana: patient.kana,
        patientNumber: patient.patientNumber,
      },
      timeline: allLogs,
      totalCount: allLogs.length,
    });
  } catch (error) {
    console.error("Audit timeline error:", error);
    if (error instanceof Error && error.message === "権限が不足しています") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "監査タイムラインの取得に失敗しました" },
      { status: 500 },
    );
  }
}
