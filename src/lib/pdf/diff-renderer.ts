import * as Diff from "diff";
import PDFDocument from "pdfkit";

/**
 * changeTypeを日本語化
 */
export function getChangeTypeLabel(changeType: string): string {
  const labels: Record<string, string> = {
    CREATE: "作成",
    UPDATE: "更新",
    DELETE: "削除",
    CONFIRM: "確定",
  };
  return labels[changeType] || changeType;
}

/**
 * 2つのテキストの差分を計算して、PDFに色分け表示
 */
type HistoryEntry = {
  beforeData?: { narrative?: string | null } | null;
  afterData?: { narrative?: string | null } | null;
  changedAt?: Date | string | number | null;
  changedByUser?: { id?: string | null; name?: string | null } | null;
};

type ChangeMeta = {
  id?: string;
  name: string;
  at: Date | null;
};

type Token = {
  ch: string;
  addedBy?: ChangeMeta;
  deletedBy?: ChangeMeta;
};

type RenderRun = {
  text: string;
  highlightColor?: string;
  strike?: boolean;
  textColor?: string;
};

export function renderTextDiff(
  doc: InstanceType<typeof PDFDocument>,
  fonts: { regular: string; bold: string },
  beforeText: string,
  afterText: string,
  maxWidth: number,
  historyEntries?: HistoryEntry[] | null,
): void {
  try {
    const runs =
      historyEntries && historyEntries.length > 0
        ? buildRunsFromHistory(historyEntries, afterText || beforeText || "")
        : buildRunsFromDiff(beforeText || "", afterText || "");

    if (runs.length === 0) {
      doc.font(fonts.regular).fillColor("#000000").text("—", {
        width: maxWidth,
        paragraphGap: 2,
      });
      return;
    }

    let left = doc.x;
    let right = left + maxWidth;
    const lineGap = 2;
    const lineHeight = doc.currentLineHeight();
    let x = left;
    let y = doc.y;

    doc.font(fonts.regular).fillColor("#000000");

    const ensurePage = () => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (y + lineHeight > bottom) {
        doc.addPage();
        left = doc.page.margins.left;
        right = left + maxWidth;
        x = left;
        y = doc.y;
      }
    };

    const newLine = () => {
      y += lineHeight + lineGap;
      x = left;
      ensurePage();
    };

    const drawStrike = (fromX: number, toX: number, atY: number) => {
      doc.moveTo(fromX, atY).lineTo(toX, atY).strokeColor("#000000").stroke();
    };

    const renderChar = (ch: string, run: RenderRun) => {
      if (ch === "\n") {
        newLine();
        return;
      }
      const w = doc.widthOfString(ch);
      if (x + w > right) {
        newLine();
      }
      ensurePage();
      if (run.highlightColor) {
        doc.fillColor(run.highlightColor);
        doc.rect(x, y, w, lineHeight).fill();
      }
      doc
        .fillColor(run.textColor ?? "#000000")
        .text(ch, x, y, { lineBreak: false });
      if (run.strike) {
        const strikeY = y + lineHeight * 0.6;
        drawStrike(x, x + w, strikeY);
      }
      x += w;
    };

    runs.forEach((run) => {
      const text = run.text;
      if (!text) return;
      for (const ch of text) {
        renderChar(ch, run);
      }
    });

    doc.fillColor("#000000");
    doc.x = left;
    doc.y = y + lineHeight;
  } catch (error) {
    // フォールバック: 差分表示に失敗した場合、通常表示
    console.error("Diff rendering failed:", error);
    doc.font(fonts.regular).fillColor("#000000");
    doc.text("変更前: " + beforeText);
    doc.text("変更後: " + afterText);
  }
}

function buildRunsFromDiff(beforeText: string, afterText: string): RenderRun[] {
  const diff = Diff.diffChars(beforeText, afterText);
  const runs: RenderRun[] = [];
  diff.forEach((part) => {
    if (!part.value) return;
    if (part.added) {
      runs.push({
        text: part.value,
        highlightColor: "#e6f4ea",
        textColor: "#000000",
      });
    } else if (part.removed) {
      runs.push({
        text: part.value,
        strike: true,
        textColor: "#000000",
      });
    } else {
      runs.push({ text: part.value, textColor: "#000000" });
    }
  });
  return runs;
}

function buildRunsFromHistory(
  historyEntries: HistoryEntry[],
  fallbackText: string,
): RenderRun[] {
  const entries = [...historyEntries].sort((a, b) => {
    const atA = toDate(a.changedAt)?.getTime() ?? 0;
    const atB = toDate(b.changedAt)?.getTime() ?? 0;
    return atA - atB;
  });
  const baseText = entries[0]?.beforeData?.narrative ?? fallbackText ?? "";

  const tokens: Token[] = baseText.split("").map((ch) => ({ ch }));
  let currentText = baseText;

  for (const entry of entries) {
    const nextText = entry.afterData?.narrative ?? currentText;
    const meta: ChangeMeta = {
      id: entry.changedByUser?.id || undefined,
      name: entry.changedByUser?.name || "—",
      at: toDate(entry.changedAt),
    };
    const diff = Diff.diffChars(currentText, nextText);

    let index = 0;
    for (const part of diff) {
      if (!part.value) continue;
      const len = part.value.length;
      if (part.added) {
        const insert: Token[] = Array.from(part.value).map((ch) => ({
          ch,
          addedBy: meta,
        }));
        tokens.splice(index, 0, ...insert);
        index += insert.length;
      } else if (part.removed) {
        index = markDeleted(tokens, index, len, meta);
      } else {
        index = advanceActive(tokens, index, len);
      }
    }
    currentText = nextText;
  }

  const runs: RenderRun[] = [];
  let current: {
    kind: "plain" | "added" | "deleted";
    metaKey: string;
    meta?: ChangeMeta;
    text: string;
  } | null = null;

  const flush = () => {
    if (!current) return;
    runs.push(...expandRun(current));
    current = null;
  };

  for (const token of tokens) {
    const kind = token.deletedBy
      ? "deleted"
      : token.addedBy
        ? "added"
        : "plain";
    const meta = token.deletedBy || token.addedBy || null;
    const metaKey = meta
      ? `${meta.id ?? meta.name}-${meta.at?.getTime() ?? "na"}`
      : "";

    if (!current || current.kind !== kind || current.metaKey !== metaKey) {
      flush();
      current = { kind, metaKey, meta: meta || undefined, text: token.ch };
    } else {
      current.text += token.ch;
    }
  }
  flush();
  return runs;
}

function expandRun(run: {
  kind: "plain" | "added" | "deleted";
  meta?: ChangeMeta;
  text: string;
}): RenderRun[] {
  const runs: RenderRun[] = [];
  if (!run.text) return runs;

  const markerKey = run.meta?.id || run.meta?.name || "";
  const markerColor = run.meta ? colorForKey(markerKey) : "#000000";
  const highlightColor = run.meta ? lighten(markerColor, 0.82) : undefined;

  const textColor = "#000000";
  const strike = run.kind === "deleted";

  const text = run.text;
  const trailingNewlines = text.match(/\n+$/)?.[0] || "";
  const coreText = trailingNewlines
    ? text.slice(0, -trailingNewlines.length)
    : text;

  if (coreText) {
    runs.push({
      text: coreText,
      highlightColor: run.kind === "added" ? highlightColor : undefined,
      strike,
      textColor,
    });
  }

  if (run.kind !== "plain" && run.meta && coreText) {
    runs.push({
      text: `（${run.meta.name} ${formatWhen(run.meta.at)}）`,
      textColor: markerColor,
    });
  }

  if (trailingNewlines) {
    runs.push({ text: trailingNewlines, textColor });
  }

  return runs;
}

function advanceActive(tokens: Token[], start: number, count: number): number {
  let i = start;
  let remaining = count;
  while (i < tokens.length && remaining > 0) {
    if (!tokens[i].deletedBy) {
      remaining -= 1;
    }
    i += 1;
  }
  return i;
}

function markDeleted(
  tokens: Token[],
  start: number,
  count: number,
  meta: ChangeMeta,
): number {
  let i = start;
  let remaining = count;
  while (i < tokens.length && remaining > 0) {
    if (!tokens[i].deletedBy) {
      tokens[i].deletedBy = meta;
      remaining -= 1;
    }
    i += 1;
  }
  return i;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad(num: number): string {
  return num.toString().padStart(2, "0");
}

function formatWhen(value: Date | null): string {
  if (!value) return "—";
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hour = pad(value.getHours());
  const minute = pad(value.getMinutes());
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function colorForKey(key: string): string {
  if (!key) return "#e60000";
  const hash = hashString(key);
  const hue = hash % 360;
  return hslToHex(hue, 100, 45);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hh = ((h % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lighten(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/**
 * 背景色付きでテキストを表示
 */
function renderLineWithBackground(
  doc: InstanceType<typeof PDFDocument>,
  fonts: { regular: string; bold: string },
  text: string,
  bgColor: string,
  textColor: string,
  maxWidth: number,
  strikethrough: boolean = false,
): void {
  const x = doc.x;
  const y = doc.y;
  const lineHeight = doc.currentLineHeight();

  // 背景を描画
  doc.rect(x, y, maxWidth, lineHeight).fill(bgColor);

  // テキストを描画
  doc.font(fonts.bold).fillColor(textColor).text(text, x, y, {
    width: maxWidth,
    paragraphGap: 2,
    strike: strikethrough,
  });
}
