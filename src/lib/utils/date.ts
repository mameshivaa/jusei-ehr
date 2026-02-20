export function normalizeDate(d?: string | null) {
  if (!d) return null;
  if (d.includes("T")) return d.split("T")[0];
  return d;
}

export function formatSlash(d?: string | null) {
  if (!d) return null;
  const nd = normalizeDate(d) as string;
  const [y, m, day] = nd.split("-");
  if (!y || !m || !day) return nd;
  return `${y}/${m}/${day}`;
}

export function daysSince(d: string): number {
  const nd = normalizeDate(d);
  if (!nd) return 0;
  const dt = new Date(nd + "T00:00:00");
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const diff = startOfToday.getTime() - dt.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function formatWeeksOnly(elapsed?: string | null) {
  if (!elapsed) return "";
  const m = elapsed.match(/(\d+)w(\d+)d/);
  if (!m) return elapsed;
  return `${m[1]}w`;
}

export function formatHM(ts?: number) {
  if (!ts) return "";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** JST オフセット（ミリ秒） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 日付キー "YYYY-MM-DD" から JST のその日の UTC 範囲を返す。
 * 受付・記載待ち一覧で同じ範囲を使うため共通化。
 */
export function getJstDayRangeFromDateKey(dateKey: string): {
  startUtc: Date;
  endUtc: Date;
} {
  const [y, m, d] = dateKey.split("-").map((v) => Number(v));
  const startUtc = new Date(Date.UTC(y, m - 1, d) - JST_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startUtc, endUtc };
}

/**
 * 任意の Date から「その日」の JST 0 時に対応する UTC の開始・終了を返す。
 */
export function getJstDayRangeFromDate(date: Date): {
  startUtc: Date;
  endUtc: Date;
} {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const d = jst.getUTCDate();
  const startUtc = new Date(Date.UTC(y, m, d) - JST_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startUtc, endUtc };
}

/**
 * 現在時刻の JST での日付キー "YYYY-MM-DD" を返す。
 */
export function getTodayDateKeyJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
