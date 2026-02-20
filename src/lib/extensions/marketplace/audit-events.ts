import { createAuditLog } from "@/lib/audit";

// 監査イベント定義
export const EXTENSION_AUDIT_ACTIONS = {
  INSTALL: "extension.install",
  INSTALL_FAILED: "extension.install.failed",
  UPDATE: "extension.update",
  UPDATE_FAILED: "extension.update.failed",
  UNINSTALL: "extension.uninstall",
  SIGNATURE_INVALID: "extension.signature.invalid",
  LICENSE_EXPIRED: "extension.license.expired",
  LICENSE_DISABLED: "extension.license.disabled",
  ADMIN_AUTH_FAILED: "extension.admin.auth.failed",
} as const;

// 使用例
export async function logExtensionInstall(
  userId: string,
  extensionId: string,
  version: string,
  success: boolean,
  error?: string,
) {
  await createAuditLog({
    userId,
    action: success
      ? EXTENSION_AUDIT_ACTIONS.INSTALL
      : EXTENSION_AUDIT_ACTIONS.INSTALL_FAILED,
    entityType: "EXTENSION",
    entityId: extensionId,
    category: "EXTENSION_LIFECYCLE",
    severity: success ? "INFO" : "WARNING",
    metadata: { version, error },
  });
}

export async function logExtensionUpdate(
  userId: string,
  extensionId: string,
  version: string,
  success: boolean,
  error?: string,
) {
  await createAuditLog({
    userId,
    action: success
      ? EXTENSION_AUDIT_ACTIONS.UPDATE
      : EXTENSION_AUDIT_ACTIONS.UPDATE_FAILED,
    entityType: "EXTENSION",
    entityId: extensionId,
    category: "EXTENSION_LIFECYCLE",
    severity: success ? "INFO" : "WARNING",
    metadata: { version, error },
  });
}

export async function logExtensionUninstall(
  userId: string,
  extensionId: string,
  version?: string,
) {
  await createAuditLog({
    userId,
    action: EXTENSION_AUDIT_ACTIONS.UNINSTALL,
    entityType: "EXTENSION",
    entityId: extensionId,
    category: "EXTENSION_LIFECYCLE",
    severity: "INFO",
    metadata: { version },
  });
}

export async function logSignatureInvalid(
  userId: string,
  extensionId: string,
  version?: string,
  error?: string,
) {
  await createAuditLog({
    userId,
    action: EXTENSION_AUDIT_ACTIONS.SIGNATURE_INVALID,
    entityType: "EXTENSION",
    entityId: extensionId,
    category: "EXTENSION_SECURITY",
    severity: "WARNING",
    metadata: { version, error },
  });
}

export async function logLicenseExpired(
  userId: string,
  extensionId: string,
  reason?: string,
) {
  await createAuditLog({
    userId,
    action: EXTENSION_AUDIT_ACTIONS.LICENSE_EXPIRED,
    entityType: "EXTENSION",
    entityId: extensionId,
    category: "EXTENSION_SECURITY",
    severity: "WARNING",
    metadata: { reason },
  });
}

export async function logLicenseDisabled(
  userId: string,
  extensionId: string,
  reason?: string,
) {
  await createAuditLog({
    userId,
    action: EXTENSION_AUDIT_ACTIONS.LICENSE_DISABLED,
    entityType: "EXTENSION",
    entityId: extensionId,
    category: "EXTENSION_SECURITY",
    severity: "WARNING",
    metadata: { reason },
  });
}

export async function logAdminAuthFailed(
  userId: string,
  attemptedAction: string,
) {
  await createAuditLog({
    userId,
    action: EXTENSION_AUDIT_ACTIONS.ADMIN_AUTH_FAILED,
    entityType: "EXTENSION",
    category: "EXTENSION_SECURITY",
    severity: "WARNING",
    metadata: { attemptedAction },
  });
}
