export const INSURANCE_OPTIONS = [
  "健康保険（協・組・日）",
  "船員保険",
  "国民健保",
  "退職者",
  "共済組合",
  "後期高齢",
  "自衛官等",
  "公費負担",
  "自費",
] as const;

export type InsuranceOptionValue = (typeof INSURANCE_OPTIONS)[number];
