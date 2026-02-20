"use client";

import React from "react";
import AccessibleModal from "@/components/ui/AccessibleModal";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmModalProps) {
  return (
    <AccessibleModal
      isOpen={open}
      onClose={onCancel}
      title={title}
      description={description || ""}
      size="sm"
    >
      <div className="flex justify-end gap-2">
        <button
          className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-800"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <button
          className={`rounded px-3 py-1.5 text-sm text-white ${busy ? "bg-gray-400" : "bg-slate-900 hover:bg-slate-800"}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </AccessibleModal>
  );
}
