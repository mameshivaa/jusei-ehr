import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireApiPermission } from "@/lib/rbac";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { createAuditLog, getAuditLogData } from "@/lib/audit";
import { EXPORT_TEMPLATE_VERSIONS } from "@/lib/export/template-versions";
import { getChartStatusLabel } from "@/lib/charts/status";
import { registerJapaneseFonts } from "@/lib/pdf/japanese-font";
import { getSettings } from "@/lib/settings";
import { renderTextDiff } from "@/lib/pdf/diff-renderer";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let auditData: ReturnType<typeof getAuditLogData> | null = null;
  let userId: string | undefined;
  let chartId: string | undefined;
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "CHART", "READ");
    await requireApiPermission(user.id, "TREATMENT_RECORD", "READ");
    userId = user.id;
    auditData = getAuditLogData(request, user.id, "EXPORT", "CHART", params.id);

    const chart = await prisma.chart.findUnique({
      where: { id: params.id },
      include: {
        patient: {
          select: { id: true, name: true, kana: true, patientNumber: true },
        },
        _count: {
          select: { visits: true, injuries: true },
        },
      },
    });

    if (!chart) {
      return NextResponse.json(
        { error: "カルテが見つかりません" },
        { status: 404 },
      );
    }
    chartId = chart.id;

    const pdfSettings = await getSettings([
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
    ]);

    const includeRecordHistory =
      pdfSettings.pdfPreviewIncludeRecordHistory === "true";
    const includeRecordInjury =
      pdfSettings.pdfPreviewIncludeRecordInjury === "true";
    const includeRecordInjuryDate =
      pdfSettings.pdfPreviewIncludeRecordInjuryDate === "true";
    const includeTreatmentDetails =
      pdfSettings.pdfPreviewIncludeTreatmentDetails === "true";

    const records = await prisma.treatmentRecord.findMany({
      where: {
        visit: { chartId: chart.id },
        isDeleted: false,
      },
      orderBy: [{ visit: { visitDate: "asc" } }, { updatedAt: "asc" }],
      include: {
        visit: { select: { id: true, visitDate: true } },
        updatedByUser: { select: { name: true } },
        ...(includeRecordInjury || includeRecordInjuryDate
          ? { injury: { select: { injuryName: true, injuryDate: true } } }
          : {}),
        ...(includeTreatmentDetails
          ? {
              treatmentDetails: {
                include: { procedure: true },
              },
            }
          : {}),
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

    const pdfBuffer = await buildChartPdf(chart, records, pdfSettings);
    if (auditData) {
      await createAuditLog({
        ...auditData,
        action: "EXPORT",
        entityType: "CHART",
        category: "DATA_ACCESS",
        metadata: {
          format: "PDF",
          templateVersion: EXPORT_TEMPLATE_VERSIONS.chartPdf,
          chartId: chart.id,
          patientId: chart.patientId,
          recordCount: records.length,
        },
      });
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="chart-${chart.id}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("chart pdf error", error);
    const errorMessage = error instanceof Error ? error.message : "unknown";
    if (auditData && userId) {
      await createAuditLog({
        ...auditData,
        action: "EXPORT",
        entityType: "CHART",
        category: "DATA_ACCESS",
        severity: "ERROR",
        metadata: {
          format: "PDF",
          templateVersion: EXPORT_TEMPLATE_VERSIONS.chartPdf,
          chartId: chartId || params.id,
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

function buildChartPdf(
  chart: any,
  records: any[],
  settings: Record<string, string>,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(c));
  const fonts = registerJapaneseFonts(doc);

  doc.fontSize(18).text("カルテ（全施術録）", { align: "center" });
  doc.moveDown(0.4);
  if (settings.pdfPreviewIncludeOutputTimestamp === "true") {
    doc
      .fontSize(10)
      .text(
        `出力日時: ${format(new Date(), "yyyy年MM月dd日 HH:mm", { locale: ja })}`,
        { align: "right" },
      );
    doc.moveDown(0.4);
  }
  doc.fontSize(11);

  const patientLabel = chart.patient.kana
    ? `${chart.patient.name} (${chart.patient.kana})`
    : chart.patient.name;

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

  if (settings.pdfPreviewIncludePatientName === "true") {
    doc.font(fonts.bold).text("患者");
    doc.font(fonts.regular).text(patientLabel);
  }
  if (settings.pdfPreviewIncludePatientId === "true") {
    doc.font(fonts.regular).text(`ID: ${chart.patient.patientNumber || "—"}`);
  }
  if (settings.pdfPreviewIncludeInsurance === "true") {
    doc.font(fonts.regular).text(`保険 ${chart.insuranceType || "未設定"}`);
  }
  if (settings.pdfPreviewIncludeStatus === "true") {
    doc
      .font(fonts.regular)
      .text(`ステータス ${getChartStatusLabel(chart.status)}`);
  }
  if (settings.pdfPreviewIncludeFirstVisitDate === "true") {
    doc.font(fonts.regular).text(`初検日 ${formatDate(chart.firstVisitDate)}`);
  }

  doc.moveDown(0.8);
  doc.font(fonts.bold).fontSize(12).text("施術録一覧");
  doc.moveDown(0.2);

  const ensureSpace = (height: number) => {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + height > bottom) doc.addPage();
  };

  const recordBaseDate =
    records
      .map((record) => toDate(record.visit?.visitDate ?? record.updatedAt))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const milestoneLabel = (current: Date | null) => {
    if (!recordBaseDate || !current) return "—";
    const diffDays = Math.max(
      0,
      Math.floor(
        (current.getTime() - recordBaseDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    if (diffDays === 0) return "初検日";
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;
    return `${weeks}w${days}d`;
  };

  records.forEach((record, index) => {
    ensureSpace(90);
    if (index > 0) {
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor("#d8dee9")
        .stroke();
      doc.moveDown(0.4);
    }

    const recordDate = toDate(record.visit?.visitDate ?? record.updatedAt);
    const displayDate = formatDate(recordDate);
    const updatedAt = formatDate(record.updatedAt, "yyyy年MM月dd日 HH:mm");
    const author = record.updatedByUser?.name || "—";

    const headerParts: string[] = [];
    if (settings.pdfPreviewIncludeRecordHeaderDate === "true") {
      headerParts.push(displayDate);
    }
    if (settings.pdfPreviewIncludeRecordHeaderMilestone === "true") {
      headerParts.push(milestoneLabel(recordDate));
    }
    if (settings.pdfPreviewIncludeRecordHeaderUpdatedAt === "true") {
      headerParts.push(`更新 ${updatedAt}`);
    }
    if (settings.pdfPreviewIncludeRecordHeaderAuthor === "true") {
      headerParts.push(`記録者 ${author}`);
    }
    if (headerParts.length > 0) {
      doc.font(fonts.bold).fontSize(11).text(headerParts.join("  "));
      doc.moveDown(0.2);
    }

    if (settings.pdfPreviewIncludeRecordContent === "true") {
      const historyEntries =
        settings.pdfPreviewIncludeRecordHistory === "true"
          ? record.history
          : null;
      const beforeNarrative = historyEntries?.length
        ? historyEntries[historyEntries.length - 1]?.beforeData?.narrative || ""
        : record.narrative || "";
      const afterNarrative = historyEntries?.length
        ? historyEntries[0]?.afterData?.narrative ||
          record.narrative ||
          "内容なし"
        : record.narrative || "内容なし";
      const maxWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.font(fonts.regular).fontSize(10);
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
        doc.text(record.narrative || "内容なし", { paragraphGap: 6 });
      }
      doc.moveDown(0.2);
    }

    if (
      settings.pdfPreviewIncludeRecordInjury === "true" &&
      record.injury?.injuryName
    ) {
      doc
        .font(fonts.regular)
        .fontSize(10)
        .text(`負傷名 ${record.injury.injuryName}`);
    }
    if (
      settings.pdfPreviewIncludeRecordInjuryDate === "true" &&
      record.injury?.injuryDate
    ) {
      doc
        .font(fonts.regular)
        .fontSize(10)
        .text(`負傷日 ${formatDate(record.injury.injuryDate)}`);
    }

    if (
      settings.pdfPreviewIncludeTreatmentDetails === "true" &&
      record.treatmentDetails?.length
    ) {
      doc.font(fonts.bold).text("施術明細");
      doc.moveDown(0.1);
      record.treatmentDetails.forEach((detail: any, idx: number) => {
        const name = detail.procedure?.name || "施術";
        const qty = detail.quantity || 1;
        const body = detail.bodyPart ? ` / 部位: ${detail.bodyPart}` : "";
        doc.font(fonts.regular).text(`${idx + 1}. ${name} x${qty}${body}`);
      });
      doc.moveDown(0.2);
    }

    // 編集履歴は本文に埋め込み表示するため、別セクションは出力しない
  });

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));
  });
}
