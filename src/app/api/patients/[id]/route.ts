import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAccessLog } from "@/lib/security/access-log";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import { createProxyOperation } from "@/lib/proxy-operation";
import { getSafeErrorMessage } from "@/lib/security/error-sanitizer";
import { logEvent } from "@/lib/activity-log";

const patientSchema = z.object({
  lastName: z.string().min(1, "姓は必須です").trim(),
  firstName: z.string().min(1, "名は必須です").trim(),
  lastKana: z.string().min(1, "セイは必須です").trim(),
  firstKana: z.string().min(1, "メイは必須です").trim(),
  birthDate: z.string().nullable().optional(),
  gender: z
    .enum(["男性", "女性", "その他", "未回答"])
    .nullable()
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(/^[0-9+\-\s]*$/, "電話番号は数字とハイフンのみで入力してください")
    .nullable()
    .optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  postalCode: z
    .string()
    .regex(/^\d{3}-?\d{4}$/, "郵便番号は7桁で入力してください")
    .nullable()
    .optional()
    .or(z.literal("")),
  prefecture: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address1: z.string().nullable().optional(),
  address2: z.string().nullable().optional(),
  patientNumber: z.string().trim().min(1, "IDは必須です"),
  memo: z.string().nullable().optional(),
  // 代行操作情報（オプション）
  isProxyOperation: z.boolean().optional(),
  approverId: z.string().optional(),
  proxyReason: z.string().optional(),
});

/**
 * 患者情報の取得（個人情報保護法対応：アクセスログ記録）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();

    const patient = await prisma.patient.findUnique({
      where: { id: params.id, isDeleted: false },
      include: {
        contacts: true,
        visits: {
          orderBy: { visitDate: "desc" },
          take: 10,
        },
        injuries: {
          where: { isDeleted: false },
          orderBy: { injuryDate: "desc" },
          include: { _count: { select: { treatmentRecords: true } } },
        },
        charts: {
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { injuries: true, visits: true } },
            injuries: { where: { isDeleted: false }, select: { id: true } },
            visits: {
              orderBy: { visitDate: "desc" },
              take: 1,
              select: { visitDate: true },
            },
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "患者が見つかりません" },
        { status: 404 },
      );
    }

    // PII復号化: 暗号化された個人情報を復号化
    const { contacts, ...patientBase } = patient;
    const decryptedPatient = {
      ...patientBase,
      phone: patient.phone
        ? PersonalInfoEncryption.decrypt(patient.phone)
        : null,
      email: patient.email
        ? PersonalInfoEncryption.decrypt(patient.email)
        : null,
      postalCode: patient.postalCode
        ? PersonalInfoEncryption.decrypt(patient.postalCode)
        : null,
      prefecture: patient.prefecture
        ? PersonalInfoEncryption.decrypt(patient.prefecture)
        : null,
      city: patient.city ? PersonalInfoEncryption.decrypt(patient.city) : null,
      address1: patient.address1
        ? PersonalInfoEncryption.decrypt(patient.address1)
        : null,
      address2: patient.address2
        ? PersonalInfoEncryption.decrypt(patient.address2)
        : null,
      address: patient.address
        ? PersonalInfoEncryption.decrypt(patient.address)
        : null,
      contacts: contacts.map((c) => ({
        ...c,
        phone: PersonalInfoEncryption.decrypt(c.phone),
      })),
      visits: patient.visits,
      injuries: patient.injuries.map((inj) => ({
        ...inj,
        treatmentCount: inj._count.treatmentRecords,
      })),
      charts: patient.charts.map((chart) => ({
        ...chart,
        visitsCount: chart._count?.visits ?? chart.visits.length ?? 0,
        injuriesCount: chart._count?.injuries ?? chart.injuries.length ?? 0,
        lastVisitDate:
          chart.visits[0]?.visitDate ?? chart.lastVisitDate ?? null,
      })),
    };

    // 個人情報保護法対応：アクセスログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "PATIENT",
      params.id,
    );
    await createAccessLog({
      userId: user.id,
      entityType: "PATIENT",
      entityId: params.id,
      action: "VIEW",
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "PATIENT",
      entityId: params.id,
      category: "DATA_ACCESS",
      metadata: {
        hasContacts: contacts.length > 0,
        hasMemo: Boolean(patient.memo),
      },
    }).catch((error) => console.error("Failed to create audit log:", error));

    return NextResponse.json(decryptedPatient);
  } catch (error) {
    console.error("Patient fetch error:", error);
    return NextResponse.json(
      { error: "患者情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();

    const patient = await prisma.patient.findUnique({
      where: { id: params.id, isDeleted: false },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "患者が見つかりません" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validatedData = patientSchema.parse(body);

    // 患者IDの重複チェック（自分以外）
    if (
      validatedData.patientNumber &&
      validatedData.patientNumber !== patient.patientNumber
    ) {
      const existing = await prisma.patient.findUnique({
        where: { patientNumber: validatedData.patientNumber },
      });
      if (existing) {
        return NextResponse.json(
          { error: "この患者IDは既に登録されています" },
          { status: 400 },
        );
      }
    }

    // PII暗号化: 更新される個人情報を暗号化
    const plainPII = {
      phone: validatedData.phone || null,
      email: validatedData.email || null,
      postalCode: validatedData.postalCode || null,
      prefecture: validatedData.prefecture || null,
      city: validatedData.city || null,
      address1: validatedData.address1 || null,
      address2: validatedData.address2 || null,
    };
    const encryptedPII = {
      phone: plainPII.phone
        ? PersonalInfoEncryption.encrypt(plainPII.phone)
        : null,
      email: plainPII.email
        ? PersonalInfoEncryption.encrypt(plainPII.email)
        : null,
      postalCode: plainPII.postalCode
        ? PersonalInfoEncryption.encrypt(plainPII.postalCode)
        : null,
      prefecture: plainPII.prefecture
        ? PersonalInfoEncryption.encrypt(plainPII.prefecture)
        : null,
      city: plainPII.city
        ? PersonalInfoEncryption.encrypt(plainPII.city)
        : null,
      address1: plainPII.address1
        ? PersonalInfoEncryption.encrypt(plainPII.address1)
        : null,
      address2: plainPII.address2
        ? PersonalInfoEncryption.encrypt(plainPII.address2)
        : null,
    };

    const updated = await prisma.patient.update({
      where: { id: params.id },
      data: {
        lastName: validatedData.lastName,
        firstName: validatedData.firstName,
        lastKana: validatedData.lastKana,
        firstKana: validatedData.firstKana,
        name: `${validatedData.lastName}${validatedData.firstName}`,
        kana: `${validatedData.lastKana}${validatedData.firstKana}`,
        birthDate: validatedData.birthDate
          ? new Date(validatedData.birthDate)
          : null,
        gender: validatedData.gender || null,
        phone: encryptedPII.phone,
        email: encryptedPII.email,
        postalCode: encryptedPII.postalCode,
        prefecture: encryptedPII.prefecture,
        city: encryptedPII.city,
        address1: encryptedPII.address1,
        address2: encryptedPII.address2,
        address: null,
        patientNumber: validatedData.patientNumber,
        memo: validatedData.memo || null,
      },
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
        "PATIENT",
        params.id,
        "UPDATE",
        validatedData.proxyReason,
      ).catch((error) => {
        console.error("Failed to create proxy operation:", error);
      });
    }

    // 監査ログとアクセスログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "UPDATE",
      "PATIENT",
      params.id,
    );
    await Promise.all([
      createAuditLog({
        ...auditData,
        action: "UPDATE",
        entityType: "PATIENT",
        entityId: params.id,
        category: "DATA_MODIFICATION",
        metadata: {
          fieldCount: Object.keys(validatedData).length,
        },
      }),
      createAccessLog({
        userId: user.id,
        entityType: "PATIENT",
        entityId: params.id,
        action: "VIEW", // UPDATE操作もアクセスログに記録
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
      }),
      logEvent("CRUD", { entity: "PATIENT", action: "UPDATE" }, user.id),
    ]).catch((error) => {
      console.error("Failed to create audit/access logs:", error);
    });

    // レスポンスでは復号化した値を返す
    return NextResponse.json({
      ...updated,
      phone: plainPII.phone,
      email: plainPII.email,
      postalCode: plainPII.postalCode,
      prefecture: plainPII.prefecture,
      city: plainPII.city,
      address1: plainPII.address1,
      address2: plainPII.address2,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: getSafeErrorMessage(error.errors[0].message) },
        { status: 400 },
      );
    }
    console.error("Patient update error:", error);
    return NextResponse.json(
      { error: "患者情報の更新に失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * 患者の論理削除（個人情報保護法対応：削除ログ記録）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();

    const patient = await prisma.patient.findUnique({
      where: { id: params.id, isDeleted: false },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "患者が見つかりません" },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const deleteReason = body.reason || body.deleteReason || "削除理由未指定";

    // 論理削除
    const deleted = await prisma.patient.update({
      where: { id: params.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // 監査ログとアクセスログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "DELETE",
      "PATIENT",
      params.id,
    );
    await Promise.all([
      createAuditLog({
        ...auditData,
        action: "DELETE",
        entityType: "PATIENT",
        entityId: params.id,
        category: "DATA_MODIFICATION",
        metadata: {
          patientName:
            `${patient.lastName ?? ""}${patient.firstName ?? ""}` ||
            patient.name,
          patientNumber: patient.patientNumber,
          deleteReason,
        },
      }),
      createAccessLog({
        userId: user.id,
        entityType: "PATIENT",
        entityId: params.id,
        action: "VIEW", // DELETE操作もアクセスログに記録
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
      }),
      logEvent("CRUD", { entity: "PATIENT", action: "DELETE" }, user.id),
    ]).catch((error) => {
      console.error("Failed to create audit/access logs:", error);
    });

    return NextResponse.json({
      ok: true,
      deleted: true,
      patientId: deleted.id,
    });
  } catch (error) {
    console.error("Patient delete error:", error);
    return NextResponse.json(
      { error: "患者の削除に失敗しました" },
      { status: 500 },
    );
  }
}
