"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type SystemMode = "NORMAL" | "READ_ONLY" | "MAINTENANCE";

type SystemModeContextType = {
  mode: SystemMode;
  isReadOnly: boolean;
  isMaintenance: boolean;
  reason?: string;
  isLoading: boolean;
  refresh: () => void;
};

const SystemModeContext = createContext<SystemModeContextType>({
  mode: "NORMAL",
  isReadOnly: false,
  isMaintenance: false,
  reason: undefined,
  isLoading: true,
  refresh: () => {},
});

export function useSystemMode() {
  return useContext(SystemModeContext);
}

export function SystemModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SystemMode>("NORMAL");
  const [reason, setReason] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  const fetchMode = async () => {
    try {
      const response = await fetch("/api/system/health");
      if (response.ok) {
        const data = await response.json();
        // systemModeがある場合はそれを使用
        if (data.checks?.systemMode) {
          setMode(data.checks.systemMode);
          setReason(data.checks.systemModeReason);
        } else if (data.readOnlyMode === true) {
          setMode("READ_ONLY");
        } else {
          setMode("NORMAL");
        }
      }
    } catch (error) {
      console.error("Failed to fetch system mode:", error);
      // エラー時は安全側でNORMALに
      setMode("NORMAL");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const skipPaths = [
      "/setup",
      "/auth",
      "/welcome",
      "/landing",
      "/products",
      "/blog",
      "/privacy",
      "/terms",
      "/",
    ];
    const shouldSkip = skipPaths.some(
      (path) => pathname === path || pathname?.startsWith(`${path}/`),
    );
    if (shouldSkip) {
      setIsLoading(false);
      return;
    }
    fetchMode();
    // 30秒ごとに更新
    const interval = setInterval(fetchMode, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  const isReadOnly = mode === "READ_ONLY";
  const isMaintenance = mode === "MAINTENANCE";

  return (
    <SystemModeContext.Provider
      value={{
        mode,
        isReadOnly,
        isMaintenance,
        reason,
        isLoading,
        refresh: fetchMode,
      }}
    >
      {children}
    </SystemModeContext.Provider>
  );
}
