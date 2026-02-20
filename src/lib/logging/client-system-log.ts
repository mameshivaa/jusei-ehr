"use client";

const LOG_ENDPOINT = "/api/system/client-logs";
const MAX_MESSAGE_LENGTH = 800;
const MAX_STACK_LENGTH = 4000;

export type ClientSystemLogEventType =
  | "runtime_error"
  | "ui_click"
  | "page_view";
export type ClientSystemLogLevel = "INFO" | "WARNING" | "ERROR";

export type ClientSystemLogPayload = {
  eventType: ClientSystemLogEventType;
  level: ClientSystemLogLevel;
  source: string;
  message: string;
  stack?: string;
  pagePath?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
};

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function sendClientSystemLog(payload: ClientSystemLogPayload): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    eventType: payload.eventType,
    level: payload.level,
    source: truncate(payload.source || "client.runtime", 120),
    message: truncate(
      payload.message || "Unknown client event",
      MAX_MESSAGE_LENGTH,
    ),
    stack: payload.stack
      ? truncate(payload.stack, MAX_STACK_LENGTH)
      : undefined,
    pagePath: payload.pagePath || window.location.pathname,
    sessionId: payload.sessionId,
    metadata: payload.metadata || {},
  });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(LOG_ENDPOINT, blob);
    return;
  }

  void fetch(LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "include",
  }).catch(() => {
    // noop
  });
}
