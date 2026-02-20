import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { writeSystemAuditLog } from "@/lib/logging/system-audit-log";
import type { SystemLogSeverity } from "@/lib/logging/system-audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 300;
const MAX_TEXT = 1200;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

type ClientLogBody = {
  eventType?: unknown;
  level?: unknown;
  source?: unknown;
  message?: unknown;
  stack?: unknown;
  pagePath?: unknown;
  metadata?: unknown;
  sessionId?: unknown;
};

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function normalizeText(value: unknown, max: number = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return truncate(trimmed, max);
}

function normalizeSeverity(value: unknown): "WARNING" | "ERROR" {
  return value === "WARNING" ? "WARNING" : "ERROR";
}

function normalizeEventType(
  value: unknown,
): "runtime_error" | "ui_click" | "page_view" {
  if (value === "ui_click" || value === "page_view") {
    return value;
  }
  return "runtime_error";
}

function resolveActionAndSeverity(
  eventType: "runtime_error" | "ui_click" | "page_view",
  level: unknown,
): { action: string; severity: SystemLogSeverity } {
  if (eventType === "ui_click") {
    return { action: "CLIENT_CLICK", severity: "INFO" };
  }
  if (eventType === "page_view") {
    return { action: "CLIENT_VIEW", severity: "INFO" };
  }
  const severity = normalizeSeverity(level);
  return {
    action: severity === "WARNING" ? "CLIENT_WARNING" : "CLIENT_ERROR",
    severity,
  };
}

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const candidate = forwardedFor.split(",")[0]?.trim();
    if (candidate) return candidate;
  }
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }
  if (current.count >= RATE_LIMIT_MAX) {
    return true;
  }
  current.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  let body: ClientLogBody;
  try {
    body = (await request.json()) as ClientLogBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const clientIp = getClientIp(request) || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const rateKey = `${clientIp}|${truncate(userAgent, 120)}`;
  if (isRateLimited(rateKey)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const user = await getCurrentUser().catch(() => null);
  const eventType = normalizeEventType(body.eventType);
  const normalized = resolveActionAndSeverity(eventType, body.level);
  const source = normalizeText(body.source, 120) || "client.runtime";
  const message =
    normalizeText(body.message, 800) ||
    (eventType === "ui_click"
      ? "Client click event"
      : eventType === "page_view"
        ? "Client page view"
        : "Unknown client runtime log");
  const stack = normalizeText(body.stack, 4000) || undefined;
  const pagePath = normalizeText(body.pagePath, 300) || undefined;
  const sessionId =
    normalizeText(body.sessionId, 191) ||
    request.headers.get("x-session-id") ||
    undefined;

  await writeSystemAuditLog({
    action: normalized.action,
    severity: normalized.severity,
    source: `client.${source}`,
    message,
    stack,
    userId: user?.id,
    sessionId,
    resourcePath: pagePath,
    ipAddress: clientIp,
    userAgent,
    metadata: {
      eventType,
      pagePath,
      metadata:
        body.metadata &&
        typeof body.metadata === "object" &&
        !Array.isArray(body.metadata)
          ? body.metadata
          : null,
    },
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
