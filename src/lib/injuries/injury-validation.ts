/**
 * 負傷エピソードのバリデーション（施術録12項目対応）
 */

export interface InjuryValidationInput {
  injuryDate: Date;
  firstVisitDate: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  autoCorrections: Record<string, unknown>;
}

/**
 * 負傷エピソードのバリデーション
 */
export function validateInjury(input: InjuryValidationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const autoCorrections: Record<string, unknown> = {};

  // 1. 初検日は負傷日以降であること
  if (input.firstVisitDate < input.injuryDate) {
    errors.push("初検日は負傷日以降でなければなりません");
  }

  // 2. 未来日チェック
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (input.injuryDate > today) {
    errors.push("負傷日に未来の日付は設定できません");
  }

  if (input.firstVisitDate > today) {
    warnings.push("初検日が未来の日付になっています");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    autoCorrections,
  };
}

/**
 * 転帰の日本語ラベル
 */
export const OUTCOME_LABELS = {
  CURED: "治癒",
  IMPROVED: "軽快",
  UNCHANGED: "不変",
  TRANSFERRED: "転医",
  DISCONTINUED: "中止",
} as const;

/**
 * 法的原因区分の日本語ラベル
 */
export const LEGAL_CAUSE_TYPE_LABELS = {
  NORMAL: "通常（日常生活）",
  WORK_ACCIDENT: "業務災害",
  COMMUTING: "通勤災害",
  TRAFFIC: "交通事故",
  OTHER: "その他",
} as const;

/**
 * 負傷タイプの選択肢を取得
 */
/**
 * 転帰の選択肢を取得
 */
export function getOutcomeOptions(): Array<{ value: string; label: string }> {
  return Object.entries(OUTCOME_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
}

/**
 * 法的原因区分の選択肢を取得
 */
export function getLegalCauseTypeOptions(): Array<{
  value: string;
  label: string;
}> {
  return Object.entries(LEGAL_CAUSE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
}
