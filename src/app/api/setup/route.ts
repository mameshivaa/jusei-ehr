import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { hashRecoveryCode } from "@/lib/security/recovery-code";
import { getPrivacyDocument, getTermsDocument } from "@/lib/terms-version";
import { ensureBackupDirectory } from "@/lib/backup/backup-manager";
import { getDefaultBackupDirectory } from "@/lib/backup/default-backup-dir";
import { PersonalInfoEncryption } from "@/lib/security/encryption";
import { getPasswordPolicyErrors } from "@/lib/security/password-policy";
import { ConsentType } from "@prisma/client";

const setupSchema = z.object({
  securityOfficer: z.object({
    role: z.string().min(1, "安全管理責任者の役職は必須です"),
    name: z.string().min(1, "安全管理責任者名は必須です"),
  }),
  confirmations: z.object({
    incidentContact: z
      .boolean()
      .refine((value) => value, "連絡体制の確認が必要です"),
    backupPolicy: z
      .boolean()
      .refine((value) => value, "バックアップと復旧手順の確認が必要です"),
    bcp: z.boolean().refine((value) => value, "BCPの確認が必要です"),
    accessLog: z
      .boolean()
      .refine((value) => value, "アクセスログ管理の確認が必要です"),
    operationPolicy: z
      .boolean()
      .refine((value) => value, "運用管理規程の確認が必要です"),
  }),
  admin: z.object({
    role: z.string().min(1, "管理者の役職は必須です"),
    name: z.string().min(1, "管理者名は必須です"),
    identifier: z.string().min(1, "管理者IDは必須です"),
    password: z.string().min(1, "パスワードを入力してください"),
  }),
  backup: z.object({
    directory: z.string().optional().default(""), // 空文字列の場合はデフォルト値を使用
    secret: z.string().min(8, "BACKUP_SECRETは8文字以上で設定してください"),
    source: z.enum(["external", "default", "custom"]).default("default"),
  }),
  agreements: z.object({
    terms: z.boolean().refine((value) => value, "利用規約の同意が必要です"),
    privacy: z
      .boolean()
      .refine((value) => value, "プライバシーポリシーの同意が必要です"),
  }),
  recoveryCode: z.string().min(8).optional(),
  recoveryCodeHash: z.string().min(20).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = setupSchema.parse(body);
    const passwordPolicyErrors = getPasswordPolicyErrors(
      validatedData.admin.password,
    );
    if (passwordPolicyErrors.length > 0) {
      return NextResponse.json(
        { error: passwordPolicyErrors[0] },
        { status: 400 },
      );
    }

    const backupSecret = validatedData.backup.secret.trim();
    const encryptedBackupSecret = PersonalInfoEncryption.encrypt(backupSecret);
    const recoveryCode = validatedData.recoveryCode?.trim();
    const recoveryCodeHash = validatedData.recoveryCodeHash?.trim();
    const effectiveRecoveryCodeHash =
      recoveryCodeHash ||
      (recoveryCode ? await hashRecoveryCode(recoveryCode) : "");

    const backupDirectory =
      validatedData.backup.directory.trim() || getDefaultBackupDirectory();
    const consentedAt = new Date();
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      null;
    const userAgent = request.headers.get("user-agent");
    const termsDoc = getTermsDocument();
    const privacyDoc = getPrivacyDocument();

    // トランザクション内でセットアップ済みチェックと作成を同時に行う（競合状態を防ぐ）
    const result = await prisma.$transaction(async (tx) => {
      const requiredKeys = [
        "backupSecret",
        "securityOfficerName",
        "securityOfficerRole",
      ];
      const existingClinic = await tx.clinic.findFirst();
      const existingKeys = await tx.systemSettings.findMany({
        where: { key: { in: requiredKeys } },
        select: { key: true },
      });
      const missingKeys = new Set(requiredKeys);
      for (const row of existingKeys) {
        missingKeys.delete(row.key);
      }
      const isAlreadySetup = Boolean(existingClinic && missingKeys.size === 0);
      if (isAlreadySetup) {
        throw new Error("既にセットアップが完了しています");
      }

      const passwordHash = await bcrypt.hash(validatedData.admin.password, 10);
      const identifier = validatedData.admin.identifier.trim().toLowerCase();

      const clinic = existingClinic
        ? await tx.clinic.update({
            where: { id: existingClinic.id },
            data: {},
          })
        : await tx.clinic.create({
            data: {},
          });

      const existingAdmin = await tx.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true, email: true },
      });
      const adminUser = existingAdmin
        ? await tx.user.update({
            where: { id: existingAdmin.id },
            data: {
              email: identifier,
              name: validatedData.admin.name,
              role: "ADMIN",
              status: "ACTIVE",
              passwordHash,
              failedLoginCount: 0,
              lockedUntil: null,
              mustChangePassword: false,
              passwordChangedAt: new Date(),
            },
          })
        : await tx.user.create({
            data: {
              email: identifier,
              name: validatedData.admin.name,
              role: "ADMIN",
              status: "ACTIVE",
              passwordHash,
              failedLoginCount: 0,
              lockedUntil: null,
              mustChangePassword: false,
              passwordChangedAt: new Date(),
            },
          });

      const settingsPayload = [
        {
          key: "securityOfficerRole",
          value: validatedData.securityOfficer.role,
          description: "Security officer role/title",
        },
        {
          key: "securityOfficerName",
          value: validatedData.securityOfficer.name,
          description: "Security officer name",
        },
        {
          key: "incidentContactConfirmed",
          value: String(validatedData.confirmations.incidentContact),
          description: "Incident contact plan confirmed",
        },
        {
          key: "backupPolicyConfirmed",
          value: String(validatedData.confirmations.backupPolicy),
          description: "Backup and restore policy confirmed",
        },
        {
          key: "bcpConfirmed",
          value: String(validatedData.confirmations.bcp),
          description: "BCP confirmed",
        },
        {
          key: "accessLogConfirmed",
          value: String(validatedData.confirmations.accessLog),
          description: "Access log management confirmed",
        },
        {
          key: "operationPolicyConfirmed",
          value: String(validatedData.confirmations.operationPolicy),
          description: "Operation policy confirmed",
        },
        {
          key: "backupDirectory",
          value: backupDirectory,
          description: "Backup directory",
        },
        {
          key: "backupDirectorySource",
          value: validatedData.backup.source,
          description: "Backup directory source",
        },
        {
          key: "backupSecret",
          value: encryptedBackupSecret,
          description: "Backup secret",
        },
        {
          key: "backupRetentionDays",
          value: "14",
          description: "Backup retention days",
        },
        {
          key: "backupRetentionCount",
          value: "5",
          description: "Backup retention count",
        },
        {
          key: "externalBackupWeeklyConfirmedAt",
          value: consentedAt.toISOString(),
          description: "External backup weekly confirmation time",
        },
        ...(effectiveRecoveryCodeHash
          ? [
              {
                key: "systemRecoveryCodeHash",
                value: effectiveRecoveryCodeHash,
                description: "System recovery code hash",
              },
            ]
          : []),
      ];

      await Promise.all(
        settingsPayload.map((item) =>
          tx.systemSettings.upsert({
            where: { key: item.key },
            create: item,
            update: {
              value: item.value,
              description: item.description,
              updatedAt: new Date(),
            },
          }),
        ),
      );

      const consentTypes: ConsentType[] = ["TERMS", "PRIVACY"];
      for (const consentType of consentTypes) {
        const exists = await tx.consentRecord.findFirst({
          where: { consentType, userId: adminUser.id },
          select: { id: true },
        });
        if (exists) continue;
        const termsMeta = consentType === "PRIVACY" ? privacyDoc : termsDoc;
        await tx.consentRecord.create({
          data: {
            consentType,
            termsVersion: termsMeta.version,
            termsHash: termsMeta.hash,
            ipAddress,
            userAgent,
            consentedAt,
            userId: adminUser.id,
          },
        });
      }

      return { clinic, adminUser };
    });

    const { clinic, adminUser } = result;

    // バックアップディレクトリを事前に作成（エラーが発生してもセットアップは成功）
    // セットアップ完了時点でディレクトリが存在することを保証
    try {
      const createdDir = await ensureBackupDirectory();
      console.log("[Setup] Backup directory ensured:", createdDir);
    } catch (backupDirError) {
      // ディレクトリ作成に失敗してもセットアップは成功として扱う
      // 初回バックアップ実行時に再度作成を試みる
      console.warn(
        "[Setup] Failed to create backup directory (will be created on first backup):",
        backupDirError,
      );
    }

    // 監査ログを記録（初期セットアップのためユーザーIDはなし）
    // エラーが発生してもセットアップは完了しているので、ログ記録のエラーは無視
    try {
      const auditData = getAuditLogData(
        request,
        undefined,
        "CREATE",
        "CLINIC",
        clinic.id,
      );
      await createAuditLog({
        ...auditData,
        action: "SYSTEM_SETUP",
        entityType: "CLINIC",
        entityId: clinic.id,
        category: "SYSTEM",
        severity: "WARNING",
        metadata: {
          adminUserId: adminUser.id,
          backupDirectory,
          termsVersion: termsDoc.version,
          termsHash: termsDoc.hash,
          privacyVersion: privacyDoc.version,
          privacyHash: privacyDoc.hash,
        },
      });
    } catch (auditError) {
      // 監査ログの記録に失敗してもセットアップは成功として扱う
      console.error("Failed to create audit log:", auditError);
    }

    return NextResponse.json({
      success: true,
      clinicId: clinic.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }

    // 既にセットアップ済みのエラーは特別に処理
    if (
      error instanceof Error &&
      error.message.includes("既にセットアップが完了しています")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "セットアップに失敗しました" },
      { status: 500 },
    );
  }
}
