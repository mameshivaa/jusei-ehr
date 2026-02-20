"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: string;
  message: string;
  variant?: ToastVariant;
  timeoutMs?: number;
};

type ToastContextValue = {
  showToast: (
    message: string,
    variant?: ToastVariant,
    timeoutMs?: number,
  ) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", timeoutMs = 3000) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = { id, message, variant, timeoutMs };
      setToasts((prev) => [...prev, item]);
      if (timeoutMs > 0) {
        setTimeout(() => removeToast(id), timeoutMs);
      }
    },
    [removeToast],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        message: string;
        variant?: ToastVariant;
        timeoutMs?: number;
      }>;
      const { message, variant, timeoutMs } = ce.detail || { message: "" };
      if (message) showToast(message, variant, timeoutMs);
    };
    window.addEventListener("app:toast", handler as EventListener);
    return () =>
      window.removeEventListener("app:toast", handler as EventListener);
  }, [showToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        {toasts.map((t) => {
          const variant: ToastVariant = t.variant ?? "info";
          const variantClassMap: Record<ToastVariant, string> = {
            success: "border border-emerald-200 bg-emerald-50 text-emerald-800",
            error: "border border-rose-200 bg-rose-50 text-rose-800",
            info: "border border-sky-200 bg-sky-50 text-sky-800",
            warning: "border border-amber-200 bg-amber-50 text-amber-800",
          };
          const variantClass = variantClassMap[variant];
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className={[
                "min-w-[260px] max-w-sm rounded-md px-4 py-3 text-sm shadow-lg backdrop-blur-sm transition-shadow",
                variantClass,
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <span>{t.message}</span>
                <button
                  onClick={() => removeToast(t.id)}
                  aria-label="閉じる"
                  className="text-current opacity-70 transition-opacity hover:opacity-100"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
