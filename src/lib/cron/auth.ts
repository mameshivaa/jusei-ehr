export type CronAuthResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

function parseBearerToken(authHeader: string | null): string {
  if (!authHeader) return "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

export function validateCronBearerAuth(
  authHeader: string | null,
  cronSecret: string | undefined,
): CronAuthResult {
  if (!cronSecret) {
    return {
      ok: false,
      status: 503,
      error: "CRON_SECRET が未設定です",
    };
  }

  const providedToken = parseBearerToken(authHeader);
  if (providedToken !== cronSecret) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  return { ok: true };
}
