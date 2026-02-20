import PdfPreviewSettingsClient from "@/components/settings/PdfPreviewSettingsClient";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const SETTING_KEYS = [
  "pdfPreviewIncludeOutputTimestamp",
  "pdfPreviewIncludePatientName",
  "pdfPreviewIncludePatientId",
  "pdfPreviewIncludeInsurance",
  "pdfPreviewIncludeStatus",
  "pdfPreviewIncludeFirstVisitDate",
  "pdfPreviewIncludeRecordHeaderDate",
  "pdfPreviewIncludeRecordHeaderMilestone",
  "pdfPreviewIncludeRecordHeaderUpdatedAt",
  "pdfPreviewIncludeRecordHeaderAuthor",
  "pdfPreviewIncludeRecordContent",
  "pdfPreviewIncludeRecordHistory",
  "pdfPreviewIncludeRecordInjury",
  "pdfPreviewIncludeRecordInjuryDate",
  "pdfPreviewIncludeTreatmentDetails",
] as const;

export default async function PdfPreviewSettingsPage() {
  await requireRole("ADMIN");
  const settings = await getSettings([...SETTING_KEYS]);
  const parsed = Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [key, value === "true"]),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          PDFプレビュー設定
        </h1>
        <p className="text-sm text-slate-600">
          PDFプレビュー/印刷/ダウンロード時に出力する項目を選択できます。
        </p>
      </div>
      <PdfPreviewSettingsClient initialSettings={parsed} />
    </div>
  );
}
