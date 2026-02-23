import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { isDevBypassAuthEnabled } from "@/lib/security/dev-bypass";

/**
 * RBAC（ロールベースアクセス制御）（ガイドライン準拠）
 *
 * 現在のロール:
 * - ADMIN: 管理者（全機能にアクセス可能）
 * - SECURITY_ADMIN: セキュリティ管理者（全機能にアクセス可能）
 * - PRACTITIONER: 柔道整復師（診療記録の閲覧・作成）
 * - RECEPTION: 受付（患者情報の閲覧・登録）
 */

export type Resource =
  | "PATIENT"
  | "CHART"
  | "VISIT"
  | "TREATMENT_RECORD"
  | "INJURY"
  | "TREATMENT_DETAIL"
  | "USER"
  | "AUDIT_LOG"
  | "SYSTEM_SETTINGS"
  | "BACKUP"
  | "EXPORT"
  | "IMPORT"
  | "SCANNED_DOCUMENT"
  | "LOGIN_ATTEMPT"
  | "EMERGENCY"
  | "PROCEDURE_MASTER";

export type Action =
  | "READ"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXPORT"
  | "ADMIN";

// ロールごとの権限定義
const ROLE_PERMISSIONS: Record<UserRole, Record<Resource, Action[]>> = {
  ADMIN: {
    PATIENT: ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    CHART: ["READ", "CREATE", "UPDATE", "DELETE"],
    VISIT: ["READ", "CREATE", "UPDATE", "DELETE"],
    TREATMENT_RECORD: ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    INJURY: ["READ", "CREATE", "UPDATE", "DELETE"],
    TREATMENT_DETAIL: ["READ", "CREATE", "UPDATE", "DELETE"],
    USER: ["READ", "CREATE", "UPDATE", "DELETE", "ADMIN"],
    AUDIT_LOG: ["READ", "EXPORT"],
    SYSTEM_SETTINGS: ["READ", "UPDATE", "ADMIN"],
    BACKUP: ["READ", "CREATE", "DELETE", "ADMIN"],
    EXPORT: ["READ", "CREATE"],
    IMPORT: ["READ", "CREATE"],
    SCANNED_DOCUMENT: ["READ", "CREATE", "UPDATE", "DELETE"],
    LOGIN_ATTEMPT: ["READ", "EXPORT"],
    EMERGENCY: ["ADMIN"],
    PROCEDURE_MASTER: ["READ", "CREATE", "UPDATE", "DELETE"],
  },
  SECURITY_ADMIN: {
    PATIENT: ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    CHART: ["READ", "CREATE", "UPDATE", "DELETE"],
    VISIT: ["READ", "CREATE", "UPDATE", "DELETE"],
    TREATMENT_RECORD: ["READ", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    INJURY: ["READ", "CREATE", "UPDATE", "DELETE"],
    TREATMENT_DETAIL: ["READ", "CREATE", "UPDATE", "DELETE"],
    USER: ["READ", "CREATE", "UPDATE", "DELETE", "ADMIN"],
    AUDIT_LOG: ["READ", "EXPORT"],
    SYSTEM_SETTINGS: ["READ", "UPDATE", "ADMIN"],
    BACKUP: ["READ", "CREATE", "DELETE", "ADMIN"],
    EXPORT: ["READ", "CREATE"],
    IMPORT: ["READ", "CREATE"],
    SCANNED_DOCUMENT: ["READ", "CREATE", "UPDATE", "DELETE"],
    LOGIN_ATTEMPT: ["READ", "EXPORT"],
    EMERGENCY: ["ADMIN"],
    PROCEDURE_MASTER: ["READ", "CREATE", "UPDATE", "DELETE"],
  },
  PRACTITIONER: {
    PATIENT: ["READ", "CREATE", "UPDATE"],
    CHART: ["READ", "CREATE", "UPDATE"],
    VISIT: ["READ", "CREATE", "UPDATE"],
    TREATMENT_RECORD: ["READ", "CREATE", "UPDATE"],
    INJURY: ["READ", "CREATE", "UPDATE", "DELETE"],
    TREATMENT_DETAIL: ["READ", "CREATE", "UPDATE", "DELETE"],
    USER: [],
    AUDIT_LOG: [],
    SYSTEM_SETTINGS: [],
    BACKUP: [],
    EXPORT: ["READ", "CREATE"],
    IMPORT: [],
    SCANNED_DOCUMENT: ["READ", "CREATE"],
    LOGIN_ATTEMPT: [],
    EMERGENCY: [],
    PROCEDURE_MASTER: ["READ"],
  },
  RECEPTION: {
    PATIENT: ["READ", "CREATE", "UPDATE"],
    CHART: ["READ", "CREATE"],
    VISIT: ["READ", "CREATE"],
    TREATMENT_RECORD: ["READ"],
    INJURY: ["READ"],
    TREATMENT_DETAIL: ["READ"],
    USER: [],
    AUDIT_LOG: [],
    SYSTEM_SETTINGS: [],
    BACKUP: [],
    EXPORT: [],
    IMPORT: [],
    SCANNED_DOCUMENT: ["READ", "CREATE"],
    LOGIN_ATTEMPT: [],
    EMERGENCY: [],
    PROCEDURE_MASTER: ["READ"],
  },
};

// ロール階層（上位ロールへの変更を制限するため）
const ROLE_HIERARCHY: Record<UserRole, number> = {
  RECEPTION: 1,
  PRACTITIONER: 2,
  ADMIN: 3,
  SECURITY_ADMIN: 4,
};

/**
 * ユーザーが指定のリソースに対して指定のアクションを実行できるかチェック
 */
export function hasPermission(
  userRole: UserRole,
  resource: Resource,
  action: Action,
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole]?.[resource] || [];
  return permissions.includes(action);
}

/**
 * ユーザーの全権限を取得
 */
export function getUserPermissions(
  userRole: UserRole,
): Record<Resource, Action[]> {
  return ROLE_PERMISSIONS[userRole] || {};
}

/**
 * 権限チェック（エラーをスロー）
 */
export function requirePermission(
  userRole: UserRole,
  resource: Resource,
  action: Action,
): void {
  if (!hasPermission(userRole, resource, action)) {
    throw new Error(
      `権限が不足しています: ${resource} に対する ${action} 権限がありません`,
    );
  }
}

/**
 * 患者単位のアクセス制御チェック
 * 将来的には患者の担当者を設定し、担当者のみアクセス可能にする
 */
export async function canAccessPatient(
  userId: string,
  patientId: string,
  action: Action,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return false;
  }

  // 基本的な権限チェック
  if (!hasPermission(user.role, "PATIENT", action)) {
    return false;
  }

  // 管理者は全患者にアクセス可能
  if (user.role === "ADMIN" || user.role === "SECURITY_ADMIN") {
    return true;
  }

  // TODO: 将来的に担当患者制限を実装
  // 現在は権限があれば全患者にアクセス可能
  return true;
}

/**
 * 施術記録単位のアクセス制御チェック
 */
export async function canAccessTreatmentRecord(
  userId: string,
  recordId: string,
  action: Action,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return false;
  }

  // 基本的な権限チェック
  if (!hasPermission(user.role, "TREATMENT_RECORD", action)) {
    return false;
  }

  // 確定済み記録の更新・削除は管理者のみ
  if (action === "UPDATE" || action === "DELETE") {
    const record = await prisma.treatmentRecord.findUnique({
      where: { id: recordId },
      select: { isConfirmed: true, updatedBy: true },
    });

    if (
      record?.isConfirmed &&
      user.role !== "ADMIN" &&
      user.role !== "SECURITY_ADMIN"
    ) {
      // 確定済みの場合、作成者でも編集不可（追記のみ可能）
      return false;
    }
  }

  return true;
}

/**
 * ユーザーのロール表示名を取得
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "管理者";
    case "SECURITY_ADMIN":
      return "セキュリティ管理者";
    case "PRACTITIONER":
      return "柔道整復師";
    case "RECEPTION":
      return "受付";
    default:
      return role;
  }
}

/**
 * 利用可能なロール一覧を取得
 */
export function getAvailableRoles(): Array<{
  value: UserRole;
  label: string;
  description: string;
}> {
  return [
    {
      value: "ADMIN",
      label: "管理者",
      description:
        "全機能にアクセス可能。ユーザー管理、システム設定、監査ログの閲覧が可能。",
    },
    {
      value: "SECURITY_ADMIN",
      label: "セキュリティ管理者",
      description:
        "全機能にアクセス可能。監査・セキュリティ運用を主担当として管理。",
    },
    {
      value: "PRACTITIONER",
      label: "柔道整復師",
      description:
        "患者情報と施術記録の閲覧・作成・編集が可能。確定済み記録の編集は不可。",
    },
    {
      value: "RECEPTION",
      label: "受付",
      description:
        "患者情報の閲覧・登録、来院記録の作成が可能。施術記録は閲覧のみ。",
    },
  ];
}

/**
 * ロール変更が許可されているかチェック
 * 自分より上位のロールには変更できない
 */
export function canChangeRole(
  changerRole: UserRole,
  targetCurrentRole: UserRole,
  targetNewRole: UserRole,
): boolean {
  const changerLevel = ROLE_HIERARCHY[changerRole];
  const targetCurrentLevel = ROLE_HIERARCHY[targetCurrentRole];
  const targetNewLevel = ROLE_HIERARCHY[targetNewRole];

  // 自分より上位のロールを持つユーザーは変更できない
  if (targetCurrentLevel >= changerLevel) {
    return false;
  }

  // 自分と同じかそれ以上のロールには昇格させられない
  if (targetNewLevel >= changerLevel) {
    return false;
  }

  return true;
}

/**
 * HTTPメソッドから対応するアクションを取得
 */
export function getActionFromMethod(method: string): Action {
  switch (method.toUpperCase()) {
    case "GET":
      return "READ";
    case "POST":
      return "CREATE";
    case "PUT":
    case "PATCH":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    default:
      return "READ";
  }
}

/**
 * APIルート用の権限チェック（エラーをスロー）
 */
export async function requireApiPermission(
  userId: string,
  resource: Resource,
  action: Action,
): Promise<void> {
  // 開発環境で認証をスキップする場合、ADMINとして扱う
  if (isDevBypassAuthEnabled() && userId === "dev-user") {
    if (!hasPermission("ADMIN", resource, action)) {
      throw new Error(
        `権限が不足しています: ${resource} に対する ${action} 権限がありません`,
      );
    }
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (!user) {
    throw new Error("ユーザーが見つかりません");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("アカウントが無効化されています");
  }

  if (!hasPermission(user.role, resource, action)) {
    throw new Error(
      `権限が不足しています: ${resource} に対する ${action} 権限がありません`,
    );
  }
}

/**
 * 全権限マトリクスを取得（監査用）
 */
export function getFullPermissionMatrix(): Record<
  UserRole,
  Record<Resource, Action[]>
> {
  return ROLE_PERMISSIONS;
}
