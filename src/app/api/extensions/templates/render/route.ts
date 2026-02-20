import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  extensionRegistry,
  initializeExtensions,
  renderTemplate,
} from "@/lib/extensions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * テンプレートをレンダリング
 *
 * Body:
 * - templateId: テンプレートID
 * - entityType: エンティティの種類（patient, chart, visit, treatmentRecord）
 * - entityId: エンティティID
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 初回アクセス時に拡張をロード
    if (extensionRegistry.getAll().length === 0) {
      await initializeExtensions("system");
    }

    const body = await request.json();
    const { templateId, entityType, entityId } = body;

    if (!templateId || !entityType || !entityId) {
      return NextResponse.json(
        { error: "templateId, entityType, entityId は必須です" },
        { status: 400 },
      );
    }

    // エンティティデータを取得
    const data = await fetchEntityData(entityType, entityId);
    if (!data) {
      return NextResponse.json(
        { error: "指定されたエンティティが見つかりません" },
        { status: 404 },
      );
    }

    // 印刷日時を追加
    data.printedAt = new Date();

    // テンプレートをレンダリング
    const result = await renderTemplate(templateId, data, user.id, user.role);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "テンプレートのレンダリングに失敗しました" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      html: result.html,
    });
  } catch (error) {
    console.error("Template render error:", error);
    return NextResponse.json(
      { error: "テンプレートのレンダリングに失敗しました" },
      { status: 500 },
    );
  }
}

/**
 * エンティティデータを取得
 */
async function fetchEntityData(
  entityType: string,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  switch (entityType) {
    case "patient": {
      const patient = await prisma.patient.findUnique({
        where: { id: entityId, isDeleted: false },
        select: {
          id: true,
          patientNumber: true,
          name: true,
          kana: true,
          birthDate: true,
          gender: true,
          memo: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!patient) return null;
      return {
        ...patient,
        birthDate: patient.birthDate?.toISOString(),
        createdAt: patient.createdAt.toISOString(),
        updatedAt: patient.updatedAt.toISOString(),
      };
    }

    case "chart": {
      const chart = await prisma.chart.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          patientId: true,
          status: true,
          insuranceType: true,
          insuranceNumber: true,
          createdAt: true,
          updatedAt: true,
          patient: {
            select: {
              id: true,
              patientNumber: true,
              name: true,
              kana: true,
              birthDate: true,
              gender: true,
            },
          },
        },
      });
      if (!chart) return null;
      return {
        ...chart,
        createdAt: chart.createdAt.toISOString(),
        updatedAt: chart.updatedAt.toISOString(),
        patient: {
          ...chart.patient,
          birthDate: chart.patient.birthDate?.toISOString(),
        },
      };
    }

    case "visit": {
      const visit = await prisma.visit.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          patientId: true,
          visitDate: true,
          createdAt: true,
          patient: {
            select: {
              id: true,
              patientNumber: true,
              name: true,
              kana: true,
            },
          },
        },
      });
      if (!visit) return null;
      return {
        ...visit,
        visitDate: visit.visitDate.toISOString(),
        createdAt: visit.createdAt.toISOString(),
      };
    }

    case "treatmentRecord": {
      const record = await prisma.treatmentRecord.findUnique({
        where: { id: entityId, isDeleted: false },
        select: {
          id: true,
          visitId: true,
          narrative: true,
          isConfirmed: true,
          confirmedAt: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          visit: {
            select: {
              id: true,
              visitDate: true,
              patient: {
                select: {
                  id: true,
                  patientNumber: true,
                  name: true,
                  kana: true,
                  birthDate: true,
                  gender: true,
                },
              },
            },
          },
        },
      });
      if (!record) return null;
      return {
        ...record,
        confirmedAt: record.confirmedAt?.toISOString(),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        visit: {
          ...record.visit,
          visitDate: record.visit.visitDate.toISOString(),
          patient: {
            ...record.visit.patient,
            birthDate: record.visit.patient.birthDate?.toISOString(),
          },
        },
      };
    }

    default:
      return null;
  }
}
