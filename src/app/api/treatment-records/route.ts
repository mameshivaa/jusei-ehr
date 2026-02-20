import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { createTreatmentRecordHistory } from "@/lib/treatment-record-history";
import { createProxyOperation } from "@/lib/proxy-operation";
import { requireApiPermission } from "@/lib/rbac";
import { logEvent } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// 施術明細スキーマ
const treatmentDetailSchema = z.object({
  procedureId: z.string().min(1, "施術は必須です"),
  bodyPart: z.string().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().int().nullable().optional(),
});

const treatmentRecordSchema = z.object({
  narrative: z.string().nullable().optional(),
  // 負傷エピソードID（新規作成時は必須、既存データのみnull許容）
  injuryId: z.string().nullable().optional(),
  // 施術明細（配列、任意）
  treatmentDetails: z.array(treatmentDetailSchema).optional(),
  // 代行操作情報（オプション）
  isProxyOperation: z.boolean().optional(),
  approverId: z.string().optional(),
  proxyReason: z.string().optional(),
  // 既存データ移行フラグ（trueの場合、injuryIdがnullでも許容）
  isLegacyData: z.boolean().optional(),
  changeReason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "TREATMENT_RECORD", "CREATE");

    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get("visitId");

    if (!visitId) {
      return NextResponse.json({ error: "visitIdが必要です" }, { status: 400 });
    }

    // 来院記録の存在確認
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: { select: { id: true } } },
    });

    if (!visit) {
      return NextResponse.json(
        { error: "来院記録が見つかりません" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validatedData = treatmentRecordSchema.parse(body);

    // 訂正理由（新規作成時も将来追跡できるように必須化）
    const changeReason =
      typeof body.changeReason === "string" &&
      body.changeReason.trim().length > 0
        ? body.changeReason.trim()
        : "初回記載";

    // 新規作成の場合、injuryIdは必須（isLegacyDataがtrueの場合を除く）
    if (!validatedData.injuryId && !validatedData.isLegacyData) {
      return NextResponse.json(
        { error: "負傷エピソードの選択は必須です" },
        { status: 400 },
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
      if (injury.patientId !== visit.patient.id) {
        return NextResponse.json(
          { error: "負傷エピソードと来院記録の患者が一致しません" },
          { status: 400 },
        );
      }
      // 日付整合性チェック: visitDate >= injury.injuryDate
      if (visit.visitDate < injury.injuryDate) {
        return NextResponse.json(
          { error: "来院日は負傷日以降である必要があります" },
          { status: 400 },
        );
      }
    }

    // トランザクションで施術記録と施術明細を保存
    const result = await prisma.$transaction(async (tx) => {
      // 施術記録を作成
      const record = await tx.treatmentRecord.create({
        data: {
          visitId,
          injuryId: validatedData.injuryId || null,
          narrative: validatedData.narrative || null,
          updatedBy: user.id,
        },
      });

      // 施術明細を作成（指定されている場合）
      let treatmentDetails: {
        id: string;
        procedureId: string;
        bodyPart: string | null;
        quantity: number;
        unitPrice: number | null;
      }[] = [];
      if (
        validatedData.treatmentDetails &&
        validatedData.treatmentDetails.length > 0
      ) {
        treatmentDetails = await Promise.all(
          validatedData.treatmentDetails.map((detail) =>
            tx.treatmentDetail.create({
              data: {
                treatmentRecordId: record.id,
                procedureId: detail.procedureId,
                bodyPart: detail.bodyPart || null,
                quantity: detail.quantity,
                unitPrice: detail.unitPrice ?? null,
              },
            }),
          ),
        );
      }

      return { record, treatmentDetails };
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
        result.record.id,
        "CREATE",
        validatedData.proxyReason,
      ).catch((error) => {
        console.error("Failed to create proxy operation:", error);
      });
    }

    // 更新履歴を記録（ガイドライン準拠）
    await createTreatmentRecordHistory(
      result.record.id,
      {},
      {
        narrative: validatedData.narrative || null,
        injuryId: validatedData.injuryId || null,
      },
      user.id,
      "CREATE",
      1,
      changeReason,
    );

    // 監査ログを記録（ガイドライン準拠）
    const auditData = getAuditLogData(
      request,
      user.id,
      "CREATE",
      "TREATMENT_RECORD",
      result.record.id,
    );
    await createAuditLog({
      userId: auditData.userId,
      sessionId: auditData.sessionId,
      action: "CREATE",
      entityType: "TREATMENT_RECORD",
      entityId: result.record.id,
      resourcePath: auditData.resourcePath,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      category: "DATA_MODIFICATION",
      metadata: {
        visitId,
        recordId: result.record.id,
        injuryId: validatedData.injuryId,
        treatmentDetailsCount: result.treatmentDetails.length,
      },
    });
    await logEvent(
      "CRUD",
      { entity: "TREATMENT_RECORD", action: "CREATE" },
      user.id,
    );

    return NextResponse.json({
      ...result.record,
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
    console.error("Treatment record creation error:", error);
    return NextResponse.json(
      { error: "施術記録の作成に失敗しました" },
      { status: 500 },
    );
  }
}
