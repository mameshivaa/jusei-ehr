/**
 * 拡張機能 - App API
 *
 * 拡張がデータにアクセスするための型付きAPI
 * DB直アクセスではなく、ユースケース単位のAPIを提供
 *
 * 特徴:
 * - 全アクセスに権限チェック
 * - 全アクセスを監査ログに記録
 * - 型安全なレスポンス
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import type {
  ExtensionCapabilities,
  ExtensionResource,
  ExtensionAction,
} from "../types";
import { logExtensionDataAccess } from "../audit-extension";
import { hasPermission, type Resource, type Action } from "@/lib/rbac";

// =============================================================================
// App API コンテキスト
// =============================================================================

/**
 * App API 呼び出し時のコンテキスト
 */
export interface AppApiContext {
  /** 拡張ID */
  extensionId: string;
  /** 拡張バージョン */
  extensionVersion: string;
  /** 実行ユーザーID */
  userId: string;
  /** ユーザーのロール */
  userRole: UserRole;
  /** 拡張に付与された権限 */
  grantedCapabilities: ExtensionCapabilities;
}

/**
 * App API の結果型
 */
export type AppApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// =============================================================================
// 権限チェックヘルパー
// =============================================================================

/**
 * 拡張リソース → RBACリソース マッピング
 */
const RESOURCE_MAPPING: Record<ExtensionResource, Resource> = {
  patient: "PATIENT",
  chart: "CHART",
  visit: "VISIT",
  treatmentRecord: "TREATMENT_RECORD",
  injury: "INJURY",
  treatmentDetail: "TREATMENT_DETAIL",
  procedureMaster: "PROCEDURE_MASTER",
  scannedDocument: "SCANNED_DOCUMENT",
};

const ACTION_MAPPING: Record<ExtensionAction, Action> = {
  read: "READ",
  create: "CREATE",
  update: "UPDATE",
  delete: "DELETE",
};

/**
 * 権限チェック（拡張の付与権限 + ユーザーRBAC の二重チェック）
 */
function checkPermission(
  ctx: AppApiContext,
  resource: ExtensionResource,
  action: ExtensionAction,
): AppApiResult<void> {
  // 1. 拡張に権限が付与されているかチェック
  const grantedActions = ctx.grantedCapabilities[resource];
  if (!grantedActions || !grantedActions.includes(action)) {
    return {
      success: false,
      error: `拡張には "${resource}" への "${action}" 権限がありません`,
    };
  }

  // 2. ユーザーのRBACロールでもアクセス可能かチェック
  const rbacResource = RESOURCE_MAPPING[resource];
  const rbacAction = ACTION_MAPPING[action];
  if (!hasPermission(ctx.userRole, rbacResource, rbacAction)) {
    return {
      success: false,
      error: `あなたのロールでは "${resource}" への "${action}" は許可されていません`,
    };
  }

  return { success: true, data: undefined };
}

// =============================================================================
// Patient API
// =============================================================================

/**
 * 患者情報（拡張に公開する範囲）
 */
export interface PatientForExtension {
  id: string;
  patientNumber: string | null;
  name: string;
  kana: string;
  birthDate: string | null;
  gender: string | null;
  memo: string | null;
  createdAt: string;
  // PII（phone, email, address）は公開しない
}

/**
 * 患者一覧を取得
 */
export async function getPatients(
  ctx: AppApiContext,
  options?: {
    limit?: number;
    offset?: number;
    search?: string;
  },
): Promise<AppApiResult<PatientForExtension[]>> {
  const permCheck = checkPermission(ctx, "patient", "read");
  if (!permCheck.success) return permCheck;

  try {
    const { limit = 100, offset = 0, search } = options || {};

    const patients = await prisma.patient.findMany({
      where: {
        isDeleted: false,
        ...(search && {
          OR: [
            { name: { contains: search } },
            { kana: { contains: search } },
            { patientNumber: { contains: search } },
          ],
        }),
      },
      select: {
        id: true,
        patientNumber: true,
        name: true,
        kana: true,
        birthDate: true,
        gender: true,
        memo: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500), // 最大500件
      skip: offset,
    });

    // 監査ログ
    await logExtensionDataAccess(
      ctx.extensionId,
      ctx.extensionVersion,
      ctx.userId,
      "patient",
      undefined,
      "read",
    );

    return {
      success: true,
      data: patients.map((p) => ({
        id: p.id,
        patientNumber: p.patientNumber,
        name: p.name,
        kana: p.kana,
        birthDate: p.birthDate?.toISOString() || null,
        gender: p.gender,
        memo: p.memo,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: `患者一覧の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

/**
 * 患者詳細を取得
 */
export async function getPatient(
  ctx: AppApiContext,
  patientId: string,
): Promise<AppApiResult<PatientForExtension>> {
  const permCheck = checkPermission(ctx, "patient", "read");
  if (!permCheck.success) return permCheck;

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, isDeleted: false },
      select: {
        id: true,
        patientNumber: true,
        name: true,
        kana: true,
        birthDate: true,
        gender: true,
        memo: true,
        createdAt: true,
      },
    });

    if (!patient) {
      return { success: false, error: "患者が見つかりません" };
    }

    // 監査ログ
    await logExtensionDataAccess(
      ctx.extensionId,
      ctx.extensionVersion,
      ctx.userId,
      "patient",
      patientId,
      "read",
    );

    return {
      success: true,
      data: {
        id: patient.id,
        patientNumber: patient.patientNumber,
        name: patient.name,
        kana: patient.kana,
        birthDate: patient.birthDate?.toISOString() || null,
        gender: patient.gender,
        memo: patient.memo,
        createdAt: patient.createdAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `患者詳細の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// =============================================================================
// Chart API
// =============================================================================

/**
 * カルテ情報（拡張に公開する範囲）
 */
export interface ChartForExtension {
  id: string;
  patientId: string;
  status: string;
  insuranceType: string | null;
  insuranceNumber: string | null;
  insuranceInsurerNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 患者のカルテ一覧を取得
 */
export async function getChartsByPatient(
  ctx: AppApiContext,
  patientId: string,
): Promise<AppApiResult<ChartForExtension[]>> {
  const permCheck = checkPermission(ctx, "chart", "read");
  if (!permCheck.success) return permCheck;

  try {
    const charts = await prisma.chart.findMany({
      where: { patientId },
      select: {
        id: true,
        patientId: true,
        status: true,
        insuranceType: true,
        insuranceNumber: true,
        insuranceInsurerNumber: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 監査ログ
    await logExtensionDataAccess(
      ctx.extensionId,
      ctx.extensionVersion,
      ctx.userId,
      "chart",
      undefined,
      "read",
    );

    return {
      success: true,
      data: charts.map((c) => ({
        id: c.id,
        patientId: c.patientId,
        status: c.status,
        insuranceType: c.insuranceType,
        insuranceNumber: c.insuranceNumber,
        insuranceInsurerNumber: c.insuranceInsurerNumber,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: `カルテ一覧の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

/**
 * カルテ概要を取得
 */
export async function getChart(
  ctx: AppApiContext,
  chartId: string,
): Promise<AppApiResult<ChartForExtension>> {
  const permCheck = checkPermission(ctx, "chart", "read");
  if (!permCheck.success) return permCheck;

  try {
    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
      select: {
        id: true,
        patientId: true,
        status: true,
        insuranceType: true,
        insuranceNumber: true,
        insuranceInsurerNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!chart) {
      return { success: false, error: "カルテが見つかりません" };
    }

    // 監査ログ
    await logExtensionDataAccess(
      ctx.extensionId,
      ctx.extensionVersion,
      ctx.userId,
      "chart",
      chartId,
      "read",
    );

    return {
      success: true,
      data: {
        id: chart.id,
        patientId: chart.patientId,
        status: chart.status,
        insuranceType: chart.insuranceType,
        insuranceNumber: chart.insuranceNumber,
        insuranceInsurerNumber: chart.insuranceInsurerNumber,
        createdAt: chart.createdAt.toISOString(),
        updatedAt: chart.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `カルテ概要の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// =============================================================================
// Treatment Record API
// =============================================================================

/**
 * 施術記録情報（拡張に公開する範囲）
 */
export interface TreatmentRecordForExtension {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  narrative: string | null;
  isConfirmed: boolean;
  confirmedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 施術記録一覧を取得
 */
export async function getTreatmentRecords(
  ctx: AppApiContext,
  options?: {
    patientId?: string;
    visitId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<AppApiResult<TreatmentRecordForExtension[]>> {
  const permCheck = checkPermission(ctx, "treatmentRecord", "read");
  if (!permCheck.success) return permCheck;

  try {
    const { patientId, visitId, limit = 100, offset = 0 } = options || {};

    const records = await prisma.treatmentRecord.findMany({
      where: {
        isDeleted: false,
        ...(visitId && { visitId }),
        ...(patientId && {
          visit: { patientId },
        }),
      },
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
            patientId: true,
            patient: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
      skip: offset,
    });

    // 監査ログ
    await logExtensionDataAccess(
      ctx.extensionId,
      ctx.extensionVersion,
      ctx.userId,
      "treatmentRecord",
      undefined,
      "read",
    );

    return {
      success: true,
      data: records.map((r) => ({
        id: r.id,
        visitId: r.visitId,
        patientId: r.visit.patientId,
        patientName: r.visit.patient.name,
        narrative: r.narrative,
        isConfirmed: r.isConfirmed,
        confirmedAt: r.confirmedAt?.toISOString() || null,
        version: r.version,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: `施術記録一覧の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

/**
 * 施術記録詳細を取得
 */
export async function getTreatmentRecord(
  ctx: AppApiContext,
  recordId: string,
): Promise<AppApiResult<TreatmentRecordForExtension>> {
  const permCheck = checkPermission(ctx, "treatmentRecord", "read");
  if (!permCheck.success) return permCheck;

  try {
    const record = await prisma.treatmentRecord.findUnique({
      where: { id: recordId, isDeleted: false },
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
            patientId: true,
            patient: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!record) {
      return { success: false, error: "施術記録が見つかりません" };
    }

    // 監査ログ
    await logExtensionDataAccess(
      ctx.extensionId,
      ctx.extensionVersion,
      ctx.userId,
      "treatmentRecord",
      recordId,
      "read",
    );

    return {
      success: true,
      data: {
        id: record.id,
        visitId: record.visitId,
        patientId: record.visit.patientId,
        patientName: record.visit.patient.name,
        narrative: record.narrative,
        isConfirmed: record.isConfirmed,
        confirmedAt: record.confirmedAt?.toISOString() || null,
        version: record.version,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `施術記録詳細の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// =============================================================================
// Visit API
// =============================================================================

/**
 * 来院記録情報（拡張に公開する範囲）
 */
export interface VisitForExtension {
  id: string;
  patientId: string;
  patientName: string;
  visitDate: string;
  hasTreatmentRecord: boolean;
  createdAt: string;
}

/**
 * 来院記録一覧を取得
 */
export async function getVisits(
  ctx: AppApiContext,
  options?: {
    patientId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  },
): Promise<AppApiResult<VisitForExtension[]>> {
  const permCheck = checkPermission(ctx, "visit", "read");
  if (!permCheck.success) return permCheck;

  try {
    const {
      patientId,
      dateFrom,
      dateTo,
      limit = 100,
      offset = 0,
    } = options || {};

    const visits = await prisma.visit.findMany({
      where: {
        ...(patientId && { patientId }),
        ...(dateFrom || dateTo
          ? {
              visitDate: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }
          : {}),
      },
      select: {
        id: true,
        patientId: true,
        visitDate: true,
        createdAt: true,
        patient: {
          select: { name: true },
        },
        treatmentRecords: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { visitDate: "desc" },
      take: Math.min(limit, 500),
      skip: offset,
    });

    // 監査ログ
    await logExtensionDataAccess(
      ctx.extensionId,
      ctx.extensionVersion,
      ctx.userId,
      "visit",
      undefined,
      "read",
    );

    return {
      success: true,
      data: visits.map((v) => ({
        id: v.id,
        patientId: v.patientId,
        patientName: v.patient.name,
        visitDate: v.visitDate.toISOString(),
        hasTreatmentRecord: v.treatmentRecords.length > 0,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: `来院記録一覧の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// =============================================================================
// Procedure Master API
// =============================================================================

/**
 * 施術マスタ情報
 */
export interface ProcedureForExtension {
  id: string;
  code: string;
  name: string;
  category: string | null;
  defaultPrice: number | null;
  isActive: boolean;
}

/**
 * 施術マスタ一覧を取得
 */
export async function getProcedures(
  ctx: AppApiContext,
  options?: {
    category?: string;
    activeOnly?: boolean;
  },
): Promise<AppApiResult<ProcedureForExtension[]>> {
  const permCheck = checkPermission(ctx, "procedureMaster", "read");
  if (!permCheck.success) return permCheck;

  try {
    const { category, activeOnly = true } = options || {};

    const procedures = await prisma.procedureMaster.findMany({
      where: {
        ...(category && { category }),
        ...(activeOnly && { isActive: true }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        defaultPrice: true,
        isActive: true,
      },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });

    // 監査ログ
    await logExtensionDataAccess(
      ctx.extensionId,
      ctx.extensionVersion,
      ctx.userId,
      "procedureMaster",
      undefined,
      "read",
    );

    return {
      success: true,
      data: procedures.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        defaultPrice: p.defaultPrice,
        isActive: p.isActive,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: `施術マスタ一覧の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// =============================================================================
// App API ファサード
// =============================================================================

/**
 * App API ファサード
 * 拡張からはこのオブジェクト経由でAPIを呼び出す
 */
export function createAppApi(ctx: AppApiContext) {
  return {
    // Patient
    getPatients: (options?: Parameters<typeof getPatients>[1]) =>
      getPatients(ctx, options),
    getPatient: (patientId: string) => getPatient(ctx, patientId),

    // Chart
    getChartsByPatient: (patientId: string) =>
      getChartsByPatient(ctx, patientId),
    getChart: (chartId: string) => getChart(ctx, chartId),

    // Treatment Record
    getTreatmentRecords: (
      options?: Parameters<typeof getTreatmentRecords>[1],
    ) => getTreatmentRecords(ctx, options),
    getTreatmentRecord: (recordId: string) => getTreatmentRecord(ctx, recordId),

    // Visit
    getVisits: (options?: Parameters<typeof getVisits>[1]) =>
      getVisits(ctx, options),

    // Procedure Master
    getProcedures: (options?: Parameters<typeof getProcedures>[1]) =>
      getProcedures(ctx, options),
  };
}

export type AppApi = ReturnType<typeof createAppApi>;
