"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * JUXSEI2互換のミューテーションガード。
 *
 * v-oss ではライセンス制限やレコードロック機構を持たないため、
 * ここでは常に「実行可能」な状態を返すシンプル実装としています。
 * インターフェースだけ合わせておくことで、UI側の移植を最小限の変更で済ませる。
 */
type GuardResult = {
  loading: boolean;
  disabled: boolean;
  tooltip: string;
  reason?: "LICENSE" | "LOCK" | "LOADING" | "NONE";
  refresh: () => void;
};

export function useMutationGuard(
  _options: { requiresLock?: boolean } = {},
): GuardResult {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const result: GuardResult = useMemo(
    () => ({
      loading: false,
      disabled: false,
      tooltip: "",
      reason: "NONE",
      refresh,
    }),
    [refresh],
  );

  return result;
}
