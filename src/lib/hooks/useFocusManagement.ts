import { useRef, useCallback, useEffect } from "react";

// モーダル等でフォーカスを管理するためのヘルパー
export function useFocusManagement() {
  const containerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current?.focus) {
      previousFocusRef.current.focus();
    }
  }, []);

  const focusFirst = useCallback(() => {
    if (!containerRef.current) return;
    const focusable = getFocusableElements(containerRef.current)[0];
    focusable?.focus();
  }, []);

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !containerRef.current) return;
    const focusable = getFocusableElements(containerRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }, []);

  return { containerRef, saveFocus, restoreFocus, focusFirst, trapFocus };
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(", ");

  return Array.from(container.querySelectorAll(selectors)).filter((el) => {
    const h = el as HTMLElement;
    return h.offsetWidth > 0 && h.offsetHeight > 0 && !h.hidden;
  }) as HTMLElement[];
}

export function useEscapeKey(onEscape: () => void, isActive = true) {
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onEscape, isActive]);
}
