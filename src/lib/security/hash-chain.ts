import crypto from "crypto";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function normalizeValue(value: unknown): JsonValue {
  if (value === null) return null;

  const valueType = typeof value;
  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return value as JsonValue;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item)) as JsonValue[];
  }

  if (valueType === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const normalized: Record<string, JsonValue> = {};
    for (const key of keys) {
      const raw = record[key];
      normalized[key] = normalizeValue(raw === undefined ? null : raw);
    }
    return normalized;
  }

  return String(value) as JsonValue;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

export function computeChainHash(
  prevHash: string | null | undefined,
  payload: unknown,
): { hash: string; normalizedPayload: string } {
  const normalizedPayload = stableStringify(payload);
  const hash = crypto
    .createHash("sha256")
    .update(`${prevHash ?? ""}${normalizedPayload}`)
    .digest("hex");

  return { hash, normalizedPayload };
}
