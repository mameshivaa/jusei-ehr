"use client";

import { ReactNode } from "react";
import { SystemModeProvider } from "./providers/SystemModeProvider";
import ToastProvider from "@/components/ui/ToastProvider";
import { TemplatePrintDialogProvider } from "@/components/extensions/TemplatePrintDialog";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SystemModeProvider>
      <ToastProvider>
        <TemplatePrintDialogProvider>{children}</TemplatePrintDialogProvider>
      </ToastProvider>
    </SystemModeProvider>
  );
}
