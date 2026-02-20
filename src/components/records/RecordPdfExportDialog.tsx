"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  recordId: string;
};

export function RecordPdfExportDialog({ recordId }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/records/${recordId}/pdf`);
      if (!res.ok) {
        throw new Error("PDF生成に失敗しました");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `treatment-record-${recordId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleExport}
      loading={loading}
    >
      <FileDown className="h-4 w-4" />
      <span className="ml-1">PDF出力</span>
    </Button>
  );
}
