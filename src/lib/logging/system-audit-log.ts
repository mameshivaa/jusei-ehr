import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/security/error-sanitizer";

const MAX_TEXT_LENGTH = 1000;
const MAX_STACK_LENGTH = 4000;
const MAX_KEYS = 30;
const MAX_ARRAY_ITEMS = 20;
const MAX_DEPTH = 3;

export type SystemLogSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

type SystemAuditLogInput = {
  action: string;
  severity?: SystemLogSeverity;
  source: string;
  message: string;
  stack?: string;
  userId?: string | null;
  sessionId?: string | null;
  resourcePath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function sanitizeString(value: string, max: number): string {
  return truncate(sanitizeErrorMessage(value), max);
}

function sanitizeUnknown(
  value: unknown,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value, MAX_TEXT_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(
        value.message || "Unknown error",
        MAX_TEXT_LENGTH,
      ),
      stack: value.stack
        ? sanitizeString(value.stack, MAX_STACK_LENGTH)
        : undefined,
    };
  }
  if (depth >= MAX_DEPTH) {
    return "[depth-limit]";
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeUnknown(item, depth + 1, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) {
      return "[circular]";
    }
    seen.add(value as object);
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_KEYS,
    );
    const normalized = entries.map(([key, item]) => [
      truncate(key, 80),
      sanitizeUnknown(item, depth + 1, seen),
    ]);
    return Object.fromEntries(normalized);
  }
  return truncate(String(value), MAX_TEXT_LENGTH);
}

function normalizeSeverity(value?: string): SystemLogSeverity {
  if (value === "WARNING" || value === "ERROR" || value === "CRITICAL") {
    return value;
  }
  return "INFO";
}

export async function writeSystemAuditLog(
  input: SystemAuditLogInput,
): Promise<void> {
  const createdAt = new Date();
  const action = truncate((input.action || "SYSTEM_EVENT").toUpperCase(), 64);
  const source = truncate(input.source || "unknown", 120);
  const message = sanitizeString(input.message || "Unknown runtime event", 800);
  const stack = input.stack
    ? sanitizeString(input.stack, MAX_STACK_LENGTH)
    : undefined;
  const severity = normalizeSeverity(input.severity);
  const entityId = truncate(input.entityId || source, 191);
  const checksumPayload = JSON.stringify({
    userId: input.userId || null,
    action,
    entityType: "SYSTEM",
    entityId,
    timestamp: createdAt.toISOString(),
  });
  const checksum = crypto
    .createHash("sha256")
    .update(checksumPayload)
    .digest("hex");

  const metadata = {
    source,
    message,
    stack: stack || null,
    detail: input.metadata ? sanitizeUnknown(input.metadata) : null,
  };

  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        sessionId: input.sessionId || null,
        action,
        entityType: "SYSTEM",
        entityId,
        resourcePath: input.resourcePath || null,
        metadata: metadata as any,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        severity,
        category: "SYSTEM",
        createdAt,
        checksum,
      },
    });
  } catch (_error) {
    // noop: ログ書き込み失敗で本処理は止めない
  }
}
