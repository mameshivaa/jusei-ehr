import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { createTreatmentRecordHistory } from "@/lib/treatment-record-history";
import { createProxyOperation } from "@/lib/proxy-operation";
import { requireApiPermission } from "@/lib/rbac";
import { createAccessLog } from "@/lib/security/access-log";
import { logEvent } from "@/lib/activity-log";

// 施術明細スキーマ
const treatmentDetailSchema = z.object({
  id: z.string().optional(), // 既存明細の場合はIDあり
  procedureId: z.string().min(1, "施術は必須です"),
  bodyPart: z.string().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().int().nullable().optional(),
});

const treatmentRecordSchema = z.object({
  narrative: z.string().nullable().optional(),
  version: z.number().int().positive(),
  // 負傷エピソードID（既存データはnull許容、紐付け可能）
  injuryId: z.string().nullable().optional(),
  // 施術明細（配列、差分更新）
  treatmentDetails: z.array(treatmentDetailSchema).optional(),
  // 代行操作情報（オプション）
  isProxyOperation: z.boolean().optional(),
  approverId: z.string().optional(),
  proxyReason: z.string().optional(),
  changeReason: z.string().optional(),
});

/**
 * GET /api/treatment-records/[id]
 * 施術記録詳細取得（施術明細含む）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "TREATMENT_RECORD", "READ");

    const record = await prisma.treatmentRecord.findUnique({
      where: { id: params.id, isDeleted: false },
      include: {
        visit: {
          select: { id: true, visitDate: true, patientId: true },
        },
        injury: {
          select: {
            id: true,
            injuryName: true,
            injuryDate: true,
            isDeleted: true,
          },
        },
        treatmentDetails: {
          include: {
            procedure: {
              select: { id: true, code: true, name: true, defaultPrice: true },
            },
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "施術記録が見つかりません" },
        { status: 404 },
      );
    }

    // アクセスログを記録
    await createAccessLog({
      userId: user.id,
      entityType: "TREATMENT_RECORD",
      entityId: params.id,
      action: "VIEW",
    }).catch((error) => {
      console.error("Failed to create access log:", error);
    });

    // 閲覧監査ログ（施術記録）
    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "TREATMENT_RECORD",
      params.id,
    );
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "TREATMENT_RECORD",
      entityId: params.id,
      category: "DATA_ACCESS",
      metadata: {
        visitId: record.visit.id,
        patientId: record.visit.patientId,
        injuryId: record.injury?.id || null,
        detailCount: record.treatmentDetails.length,
      },
    }).catch((error) => console.error("Failed to create audit log:", error));

    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Treatment record detail error:", error);
    return NextResponse.json(
      { error: "施術記録の取得に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/treatment-records/[id]
 * 施術記録更新（施術明細含むトランザクション）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "TREATMENT_RECORD", "UPDATE");

    const record = await prisma.treatmentRecord.findUnique({
      where: { id: params.id, isDeleted: false },
      include: {
        visit: { select: { patientId: true } },
        treatmentDetails: true,
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "施術記録が見つかりません" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validatedData = treatmentRecordSchema.parse(body);

    const changeReason =
      typeof body.changeReason === "string" &&
      body.changeReason.trim().length > 0
        ? body.changeReason.trim()
        : "内容更新";

    // 楽観的ロックチェック
    if (validatedData.version !== record.version) {
      return NextResponse.json(
        {
          error:
            "記録が他のユーザーによって更新されています。ページを再読み込みしてください。",
        },
        { status: 409 },
      );
    }

    // injuryIdが指定されている場合、存在確認と患者一致チェック
    if (validatedData.injuryId) {
      const injury = await prisma.injury.findUnique({
        where: { id: validatedData.injuryId },
      });
      if (!injury) {
        return NextResponse.json(
          { error: "負傷エピソードが見つかりません" },
          { status: 404 },
        );
      }
      if (injury.isDeleted) {
        return NextResponse.json(
          { error: "削除された負傷エピソードは選択できません" },
          { status: 400 },
        );
      }
      if (injury.patientId !== record.visit.patientId) {
        return NextResponse.json(
          { error: "負傷エピソードと施術記録の患者が一致しません" },
          { status: 400 },
        );
      }
    }

    // 変更前のデータを保存（更新履歴用）
    const oldData = {
      narrative: record.narrative,
      injuryId: record.injuryId,
    };

    // トランザクションで更新
    const result = await prisma.$transaction(async (tx) => {
      // 施術記録を更新
      const updated = await tx.treatmentRecord.update({
        where: { id: params.id },
        data: {
          narrative: validatedData.narrative || null,
          injuryId:
            validatedData.injuryId !== undefined
              ? validatedData.injuryId
              : record.injuryId,
          version: record.version + 1,
          updatedBy: user.id,
        },
      });

      // 施術明細を更新（指定されている場合）
      let treatmentDetails = record.treatmentDetails;
      if (validatedData.treatmentDetails !== undefined) {
        // 既存の明細を削除
        await tx.treatmentDetail.deleteMany({
          where: { treatmentRecordId: params.id },
        });

        // 新しい明細を作成
        if (validatedData.treatmentDetails.length > 0) {
          treatmentDetails = await Promise.all(
            validatedData.treatmentDetails.map((detail) =>
              tx.treatmentDetail.create({
                data: {
                  treatmentRecordId: params.id,
                  procedureId: detail.procedureId,
                  bodyPart: detail.bodyPart || null,
                  quantity: detail.quantity,
                  unitPrice: detail.unitPrice ?? null,
                },
              }),
            ),
          );
        } else {
          treatmentDetails = [];
        }
      }

      return { updated, treatmentDetails };
    });

    // 代行操作の場合、ProxyOperationレコードを作成
    if (
      validatedData.isProxyOperation &&
      validatedData.approverId &&
      validatedData.proxyReason
    ) {
      await createProxyOperation(
        user.id,
        validatedData.approverId,
        "TREATMENT_RECORD",
        params.id,
        "UPDATE",
        validatedData.proxyReason,
      ).catch((error) => {
        console.error("Failed to create proxy operation:", error);
      });
    }

    // 更新履歴を記録（ガイドライン準拠）
    await createTreatmentRecordHistory(
      record.id,
      oldData,
      {
        narrative: validatedData.narrative || null,
        injuryId:
          validatedData.injuryId !== undefined
            ? validatedData.injuryId
            : record.injuryId,
      },
      user.id,
      "UPDATE",
      record.version,
      changeReason,
    );

    // 監査ログを記録（ガイドライン準拠）
    const auditData = getAuditLogData(
      request,
      user.id,
      "UPDATE",
      "TREATMENT_RECORD",
      record.id,
    );
    await createAuditLog({
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      action: auditData.action || "UPDATE",
      entityType: auditData.entityType || "TREATMENT_RECORD",
      entityId: auditData.entityId,
      resourcePath: auditData.resourcePath,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      category: "DATA_MODIFICATION",
      metadata: {
        recordId: record.id,
        oldVersion: record.version,
        newVersion: result.updated.version,
        injuryIdChanged: oldData.injuryId !== result.updated.injuryId,
        treatmentDetailsCount: result.treatmentDetails.length,
      },
    });

    await logEvent(
      "CRUD",
      { entity: "TREATMENT_RECORD", action: "UPDATE" },
      user.id,
    );

    return NextResponse.json({
      ...result.updated,
      treatmentDetails: result.treatmentDetails,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Treatment record update error:", error);
    return NextResponse.json(
      { error: "施術記録の更新に失敗しました" },
      { status: 500 },
    );
  }
}
