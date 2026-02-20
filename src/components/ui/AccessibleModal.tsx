import React, { useEffect } from "react";
import {
  useFocusManagement,
  useEscapeKey,
} from "@/lib/hooks/useFocusManagement";
import { useAriaId } from "@/lib/hooks/useAriaId";
import { ModalTransition } from "@/components/ui/PageTransition";

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "xxl" | "3xl";
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  headerActions?: React.ReactNode;
  className?: string;
}

export default function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnBackdropClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  headerActions,
  className = "",
}: AccessibleModalProps) {
  const titleId = useAriaId("modal-title");
  const descriptionId = useAriaId("modal-desc");

  const { containerRef, saveFocus, restoreFocus, focusFirst, trapFocus } =
    useFocusManagement();
  useEscapeKey(onClose, isOpen && closeOnEsc);

  useEffect(() => {
    if (isOpen) {
      saveFocus();
      setTimeout(() => focusFirst(), 100);
    } else {
      restoreFocus();
    }
  }, [isOpen, saveFocus, restoreFocus, focusFirst]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", trapFocus);
      return () => document.removeEventListener("keydown", trapFocus);
    }
  }, [isOpen, trapFocus]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses: Record<
    NonNullable<AccessibleModalProps["size"]>,
    string
  > = {
    sm: "w-full max-w-sm",
    md: "w-full max-w-md",
    lg: "w-full max-w-lg",
    xl: "w-full max-w-2xl",
    xxl: "w-full max-w-screen-2xl",
    "3xl": "w-[65vw]",
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <ModalTransition isOpen={isOpen}>
          <div
            ref={containerRef as React.RefObject<HTMLDivElement>}
            className={`relative flex ${sizeClasses[size]} transform flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md ${className}`}
            style={{ maxHeight: "85vh" }}
          >
            <div className="border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2
                    id={titleId}
                    className="text-lg font-semibold text-gray-900"
                  >
                    {title}
                  </h2>
                  {description && (
                    <p
                      id={descriptionId}
                      className="mt-1 text-sm text-gray-600"
                    >
                      {description}
                    </p>
                  )}
                </div>
                {headerActions && (
                  <div className="flex-shrink-0 flex items-center">
                    {headerActions}
                  </div>
                )}
              </div>
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-slate-500"
                aria-label="閉じる"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}

            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
              {children}
            </div>
          </div>
        </ModalTransition>
      </div>
    </div>
  );
}
