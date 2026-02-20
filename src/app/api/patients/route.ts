import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { createAccessLog } from "@/lib/security/access-log";
import { createProxyOperation } from "@/lib/proxy-operation";
import { requireApiPermission } from "@/lib/rbac";
import { getSafeErrorMessage } from "@/lib/security/error-sanitizer";
import { logEvent } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// 一覧取得（検索付き）
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "PATIENT", "READ");

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const recent = searchParams.get("recent") === "1";
    const takeParam = Number(searchParams.get("take") || "");
    const take = Number.isFinite(takeParam) && takeParam > 0 ? takeParam : 100;

    const where = {
      isDeleted: false,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { kana: { contains: q } },
              { lastName: { contains: q } },
              { firstName: { contains: q } },
              { lastKana: { contains: q } },
              { firstKana: { contains: q } },
              { patientNumber: { contains: q } },
            ],
          }
        : {}),
    };

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: recent ? Math.min(take, 200) : take,
      include: {
        _count: { select: { charts: true, injuries: true, visits: true } },
        visits: {
          orderBy: { visitDate: "desc" },
          take: 1,
          select: { visitDate: true },
        },
      },
    });

    const mapped = patients.map((p) => ({
      id: p.id,
      name: `${p.lastName} ${p.firstName}`.trim() || p.name,
      kana: `${p.lastKana} ${p.firstKana}`.trim() || p.kana,
      patientNumber: p.patientNumber,
      birthDate: p.birthDate,
      gender: p.gender,
      chartsCount: p._count.charts,
      injuriesCount: p._count.injuries,
      visitsCount: p._count.visits,
      lastVisit: p.visits[0]?.visitDate ?? null,
      memo: p.memo,
      updatedAt: p.updatedAt,
    }));

    if (recent && !q) {
      const sorted = mapped
        .slice()
        .sort((a, b) => {
          const aTime = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
          const bTime = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
          if (aTime !== bTime) return bTime - aTime;
          const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bUpdated - aUpdated;
        })
        .slice(0, Math.min(take, 100))
        .map(({ updatedAt, ...rest }) => rest);
      return NextResponse.json(sorted);
    }

    return NextResponse.json(mapped.map(({ updatedAt, ...rest }) => rest));

    // 閲覧ログ（患者一覧）
    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "PATIENT",
      undefined,
    );
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "PATIENT",
      entityId: undefined,
      category: "DATA_ACCESS",
      metadata: {
        query: q || null,
        resultCount: patients.length,
        limit: 100,
      },
    }).catch((error) => console.error("Failed to create audit log:", error));
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json(
        { error: getSafeErrorMessage(error) },
        { status: 403 },
      );
    }
    console.error("Patients list error:", error);
    return NextResponse.json(
      { error: "患者一覧の取得に失敗しました" },
      { status: 500 },
    );
  }
}

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
  patientNumber: z.string().trim().min(1, "患者IDは必須です"),
  memo: z.string().nullable().optional(),
  contacts: z
    .array(
      z.object({
        phone: z
          .string()
          .regex(
            /^[0-9+\-\s]*$/,
            "電話番号は数字とハイフンのみで入力してください",
          )
          .min(1, "電話番号を入力してください"),
        relation: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
      }),
    )
    .optional(),
  // 代行操作情報（オプション）
  isProxyOperation: z.boolean().optional(),
  approverId: z.string().optional(),
  proxyReason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // 権限チェック
    await requireApiPermission(user.id, "PATIENT", "CREATE");

    const body = await request.json();
    const validatedData = patientSchema.parse(body);

    // 患者IDの重複チェック
    if (validatedData.patientNumber) {
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

    // PII暗号化: 個人情報を暗号化
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

    const patient = await prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
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

      const contactsPayload =
        validatedData.contacts?.map((c) => ({
          patientId: created.id,
          phone: PersonalInfoEncryption.encrypt(c.phone),
          relation: c.relation || null,
          name: c.name || null,
        })) || [];

      if (contactsPayload.length > 0) {
        await tx.patientContact.createMany({
          data: contactsPayload,
        });
      }

      return created;
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
        patient.id,
        "CREATE",
        validatedData.proxyReason,
      ).catch((error) => {
        console.error("Failed to create proxy operation:", error);
      });
    }

    // 監査ログとアクセスログを記録
    const auditData = getAuditLogData(
      request,
      user.id,
      "CREATE",
      "PATIENT",
      patient.id,
    );
    await Promise.all([
      createAuditLog({
        ...auditData,
        action: "CREATE",
        entityType: "PATIENT",
        entityId: patient.id,
        category: "DATA_MODIFICATION",
        metadata: {
          patientName: `${validatedData.lastName}${validatedData.firstName}`,
          patientNumber: validatedData.patientNumber,
        },
      }),
      createAccessLog({
        userId: user.id,
        entityType: "PATIENT",
        entityId: patient.id,
        action: "VIEW", // CREATE操作もアクセスログに記録
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
      }),
      logEvent("CRUD", { entity: "PATIENT", action: "CREATE" }, user.id),
    ]).catch((error) => {
      console.error("Failed to create audit/access logs:", error);
    });

    // レスポンスでは復号化した値を返す
    return NextResponse.json({
      ...patient,
      name: `${patient.lastName}${patient.firstName}`,
      kana: `${patient.lastKana}${patient.firstKana}`,
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
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json(
        { error: getSafeErrorMessage(error) },
        { status: 403 },
      );
    }
    console.error("Patient creation error:", error);
    return NextResponse.json(
      { error: "患者の登録に失敗しました" },
      { status: 500 },
    );
  }
}
