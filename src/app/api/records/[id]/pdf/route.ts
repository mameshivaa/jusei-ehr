import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireApiPermission } from "@/lib/rbac";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { EXPORT_TEMPLATE_VERSIONS } from "@/lib/export/template-versions";
import { registerJapaneseFonts } from "@/lib/pdf/japanese-font";
import { getSettings } from "@/lib/settings";
import { renderTextDiff } from "@/lib/pdf/diff-renderer";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  let auditData: ReturnType<typeof getAuditLogData> | null = null;
  let userId: string | undefined;
  let recordId: string | undefined;
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "TREATMENT_RECORD", "READ");
    userId = user.id;
    auditData = getAuditLogData(
      _req,
      user.id,
      "EXPORT",
      "TREATMENT_RECORD",
      params.id,
    );

    const pdfSettings = await getSettings(["pdfPreviewIncludeRecordHistory"]);
    const includeRecordHistory =
      pdfSettings.pdfPreviewIncludeRecordHistory === "true";

    const record = await prisma.treatmentRecord.findUnique({
      where: { id: params.id, isDeleted: false },
      include: {
        visit: {
          include: {
            patient: true,
          },
        },
        injury: true,
        treatmentDetails: {
          include: {
            procedure: true,
          },
        },
        ...(includeRecordHistory
          ? {
              history: {
                include: {
                  changedByUser: { select: { id: true, name: true } },
                },
                orderBy: { changedAt: "desc" },
              },
            }
          : {}),
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "施術記録が見つかりません" },
        { status: 404 },
      );
    }
    recordId = record.id;

    const pdfBuffer = await buildPdf(record, pdfSettings);
    if (auditData) {
      await createAuditLog({
        ...auditData,
        action: "EXPORT",
        entityType: "TREATMENT_RECORD",
        category: "DATA_ACCESS",
        metadata: {
          format: "PDF",
          templateVersion: EXPORT_TEMPLATE_VERSIONS.treatmentRecordPdf,
          recordId: record.id,
          visitId: record.visitId,
          patientId: record.visit.patientId,
        },
      });
    }
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="treatment-record-${record.id}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("record pdf error", error);
    const errorMessage = error instanceof Error ? error.message : "unknown";
    if (auditData && userId) {
      await createAuditLog({
        ...auditData,
        action: "EXPORT",
        entityType: "TREATMENT_RECORD",
        category: "DATA_ACCESS",
        severity: "ERROR",
        metadata: {
          format: "PDF",
          templateVersion: EXPORT_TEMPLATE_VERSIONS.treatmentRecordPdf,
          recordId: recordId || params.id,
          success: false,
          error: errorMessage,
        },
      });
    }
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? errorMessage
            : "PDFの生成に失敗しました",
      },
      { status: 500 },
    );
  }
}

async function buildPdf(
  record: any,
  settings: Record<string, string>,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(c));
  const fonts = registerJapaneseFonts(doc);

  doc.fontSize(18).text("施術録", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11);

  const patient = record.visit.patient;
  const injury = record.injury;
  const toDate = (value?: Date | string | number | null) => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const formatDate = (
    value?: Date | string | number | null,
    pattern: string = "yyyy年MM月dd日",
  ) => {
    const parsed = toDate(value);
    return parsed ? format(parsed, pattern, { locale: ja }) : "—";
  };

  const visitDate = formatDate(record.visit?.visitDate, "yyyy年MM月dd日 HH:mm");
  const injuryDate = injury
    ? formatDate(injury.injuryDate, "yyyy年MM月dd日")
    : "—";

  const addField = (label: string, value: string | null | undefined) => {
    doc
      .font(fonts.bold)
      .text(`${label}`, { continued: true })
      .font(fonts.regular)
      .text(` ${value || ""}`);
  };

  addField("患者", `${patient.name} (${patient.kana || ""})`);
  addField("患者ID", patient.patientNumber || "—");
  addField("来院日時", visitDate);
  addField("負傷日", injuryDate);
  addField("負傷名", injury?.injuryName || "—");
  doc.moveDown(1);

  const maxWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const historyEntries =
    settings.pdfPreviewIncludeRecordHistory === "true" ? record.history : null;
  const beforeNarrative = historyEntries?.length
    ? historyEntries[historyEntries.length - 1]?.beforeData?.narrative || ""
    : record.narrative || "";
  const afterNarrative = historyEntries?.length
    ? historyEntries[0]?.afterData?.narrative || record.narrative || "内容なし"
    : record.narrative || "内容なし";

  doc.font(fonts.bold).text("記録内容");
  doc.moveDown(0.2);
  if (historyEntries && historyEntries.length > 0) {
    renderTextDiff(
      doc,
      fonts,
      beforeNarrative,
      afterNarrative,
      maxWidth,
      historyEntries,
    );
  } else {
    doc.font(fonts.regular).text(record.narrative || "内容なし", {
      paragraphGap: 8,
    });
  }
  doc.moveDown(0.4);

  if (record.treatmentDetails?.length) {
    doc.font(fonts.bold).text("施術明細");
    doc.moveDown(0.3);
    record.treatmentDetails.forEach((d: any, idx: number) => {
      const name = d.procedure?.name || "施術";
      const qty = d.quantity || 1;
      const body = d.bodyPart ? ` / 部位: ${d.bodyPart}` : "";
      doc.font(fonts.regular).text(`${idx + 1}. ${name} x${qty}${body}`);
    });
  }

  // 編集履歴は本文に埋め込み表示するため、別セクションは出力しない

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));
  });
}
