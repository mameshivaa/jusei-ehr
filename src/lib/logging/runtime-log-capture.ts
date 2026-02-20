import { writeSystemAuditLog } from "@/lib/logging/system-audit-log";

const ENABLED =
  (process.env.RUNTIME_LOG_CAPTURE_ENABLED ?? "true").toLowerCase() !== "false";
const DUPLICATE_WINDOW_MS = 5000;
const RECENT_SIGNATURE_LIMIT = 300;
const MAX_ARGS = 6;
const MAX_ARG_TEXT = 500;

type RuntimeCaptureState = {
  installed: boolean;
  recentSignatures: Map<string, number>;
};

type GlobalWithCaptureState = typeof globalThis & {
  __vossRuntimeCaptureState?: RuntimeCaptureState;
};

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function formatArg(value: unknown): string {
  if (value instanceof Error) {
    return truncate(`${value.name}: ${value.message}`, MAX_ARG_TEXT);
  }
  if (typeof value === "string") {
    return truncate(value, MAX_ARG_TEXT);
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value == null
  ) {
    return String(value);
  }
  try {
    return truncate(JSON.stringify(value), MAX_ARG_TEXT);
  } catch {
    return truncate(String(value), MAX_ARG_TEXT);
  }
}

function getErrorFromArgs(args: unknown[]): Error | undefined {
  return args.find((arg) => arg instanceof Error) as Error | undefined;
}

function getMessageFromArgs(args: unknown[]): string {
  const error = getErrorFromArgs(args);
  if (error?.message) return truncate(error.message, 800);
  const joined = args.slice(0, MAX_ARGS).map(formatArg).join(" ");
  return truncate(joined || "Unknown runtime log", 800);
}

function cleanupSignatures(state: RuntimeCaptureState, now: number) {
  if (state.recentSignatures.size <= RECENT_SIGNATURE_LIMIT) return;
  for (const [key, ts] of state.recentSignatures.entries()) {
    if (now - ts > DUPLICATE_WINDOW_MS) {
      state.recentSignatures.delete(key);
    }
  }
}

function shouldSkipDuplicate(state: RuntimeCaptureState, signature: string) {
  const now = Date.now();
  const prev = state.recentSignatures.get(signature);
  if (prev && now - prev <= DUPLICATE_WINDOW_MS) {
    return true;
  }
  state.recentSignatures.set(signature, now);
  cleanupSignatures(state, now);
  return false;
}

function getCaptureState(): RuntimeCaptureState {
  const globalObject = globalThis as GlobalWithCaptureState;
  if (!globalObject.__vossRuntimeCaptureState) {
    globalObject.__vossRuntimeCaptureState = {
      installed: false,
      recentSignatures: new Map<string, number>(),
    };
  }
  return globalObject.__vossRuntimeCaptureState;
}

function toErrorPayload(errorLike: unknown): {
  message: string;
  stack?: string;
} {
  if (errorLike instanceof Error) {
    return {
      message: errorLike.message || errorLike.name || "Unknown error",
      stack: errorLike.stack,
    };
  }
  if (typeof errorLike === "string") {
    return { message: errorLike };
  }
  return { message: formatArg(errorLike) || "Unknown error" };
}

function writeWithGuard(payload: Parameters<typeof writeSystemAuditLog>[0]) {
  void writeSystemAuditLog(payload);
}

function captureConsole(
  state: RuntimeCaptureState,
  level: "WARNING" | "ERROR",
  source: string,
  args: unknown[],
) {
  if (!ENABLED) {
    return;
  }
  const message = getMessageFromArgs(args);
  const error = getErrorFromArgs(args);
  const serializedArgs = args.slice(0, MAX_ARGS).map(formatArg);
  const signature = `${source}|${level}|${message}|${error?.stack?.slice(0, 160) || ""}`;
  if (shouldSkipDuplicate(state, signature)) {
    return;
  }
  writeWithGuard({
    action: level === "WARNING" ? "SYSTEM_WARNING" : "SYSTEM_ERROR",
    severity: level,
    source,
    message,
    stack: error?.stack,
    metadata: {
      args: serializedArgs,
      pid: process.pid,
      runtime: "nodejs",
    },
  });
}

function captureProcessError(
  state: RuntimeCaptureState,
  action: string,
  source: string,
  severity: "WARNING" | "ERROR" | "CRITICAL",
  errorLike: unknown,
  metadata?: Record<string, unknown>,
) {
  if (!ENABLED) {
    return;
  }
  const payload = toErrorPayload(errorLike);
  const signature = `${source}|${action}|${payload.message}|${payload.stack?.slice(0, 160) || ""}`;
  if (shouldSkipDuplicate(state, signature)) {
    return;
  }
  writeWithGuard({
    action,
    severity,
    source,
    message: payload.message,
    stack: payload.stack,
    metadata: {
      pid: process.pid,
      runtime: "nodejs",
      ...metadata,
    },
  });
}

export function installRuntimeLogCapture() {
  if (!ENABLED) return;
  const state = getCaptureState();
  if (state.installed) return;
  state.installed = true;

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    originalError(...args);
    captureConsole(state, "ERROR", "console.error", args);
  };
  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    captureConsole(state, "WARNING", "console.warn", args);
  };

  process.on("warning", (warning) => {
    captureProcessError(
      state,
      "PROCESS_WARNING",
      "process.warning",
      "WARNING",
      warning,
    );
  });

  process.on("unhandledRejection", (reason) => {
    captureProcessError(
      state,
      "UNHANDLED_REJECTION",
      "process.unhandledRejection",
      "CRITICAL",
      reason,
    );
  });

  process.on("uncaughtExceptionMonitor", (error, origin) => {
    captureProcessError(
      state,
      "UNCAUGHT_EXCEPTION",
      "process.uncaughtExceptionMonitor",
      "CRITICAL",
      error,
      { origin },
    );
  });
}
