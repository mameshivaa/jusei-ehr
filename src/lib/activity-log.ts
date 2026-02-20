/**
 * OSS 公開版では外部への利用状況送信を行わない。
 * 互換性維持のため API は残し、呼び出しは no-op とする。
 */

type DraftEntityType = "chart" | "injury" | "record";

type EventType =
  | "LOGIN"
  | "LOGOUT"
  | "PAGE_VIEW"
  | "ERROR"
  | "FEATURE_ACTION"
  | "PERFORMANCE"
  | "CRUD"
  | "DRAFT_START"
  | "DRAFT_COMMIT"
  | "DRAFT_PAUSE"
  | "DRAFT_REOPEN";

type EventMetadata = {
  [key: string]: unknown;
};

type LogEventOptions = {
  actorId?: string | null;
  sessionId?: string | null;
  entityType?: DraftEntityType | null;
  entityId?: string | null;
  durationMs?: number | null;
  clientTs?: Date | string | null;
  eventVersion?: number | null;
};

/**
 * イベントログを送信
 */
export async function logEvent(
  eventType: EventType,
  metadata?: EventMetadata,
  userId?: string,
  options?: LogEventOptions,
): Promise<void> {
  void eventType;
  void metadata;
  void userId;
  void options;
}

export type { EventType, DraftEntityType, LogEventOptions };

/**
 * ログインイベントを記録
 */
export async function logLogin(
  userId: string,
  metadata?: EventMetadata,
): Promise<void> {
  await logEvent(
    "LOGIN",
    { ...metadata, timestamp: new Date().toISOString() },
    userId,
  );
}

/**
 * ログアウトイベントを記録
 */
export async function logLogout(
  userId: string,
  metadata?: EventMetadata,
): Promise<void> {
  await logEvent(
    "LOGOUT",
    { ...metadata, timestamp: new Date().toISOString() },
    userId,
  );
}

/**
 * ページビューイベントを記録
 */
export async function logPageView(
  path: string,
  userId?: string,
  metadata?: EventMetadata,
): Promise<void> {
  await logEvent("PAGE_VIEW", { path, ...metadata }, userId);
}

/**
 * エラーイベントを記録
 */
export async function logError(
  errorType: string,
  errorMessage: string,
  stackHash?: string,
  userId?: string,
  metadata?: EventMetadata,
): Promise<void> {
  await logEvent(
    "ERROR",
    {
      error_type: errorType,
      error_message: errorMessage,
      stack_hash: stackHash,
      ...metadata,
    },
    userId,
  );
}

/**
 * 機能使用イベントを記録
 */
export async function logFeatureAction(
  featureName: string,
  userId?: string,
  metadata?: EventMetadata,
): Promise<void> {
  await logEvent(
    "FEATURE_ACTION",
    { feature_name: featureName, ...metadata },
    userId,
  );
}

/**
 * パフォーマンスメトリクスを記録
 */
export async function logPerformance(
  metricName: string,
  value: number,
  unit: string = "ms",
  userId?: string,
  metadata?: EventMetadata,
): Promise<void> {
  await logEvent(
    "PERFORMANCE",
    {
      metric_name: metricName,
      value,
      unit,
      ...metadata,
    },
    userId,
  );
}
