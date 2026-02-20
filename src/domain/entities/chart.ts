export type PatientEntity = {
  id: string;
  name: string;
  kana: string | null;
  patientNumber: string | null;
};

export type ChartStatusValue =
  | "IN_TREATMENT"
  | "HEALED"
  | "DISCONTINUED"
  | "TRANSFERRED"
  | string;

export type ChartSummaryEntity = {
  id: string;
  status?: ChartStatusValue | null;
  insuranceType?: string | null;
  firstVisitDate?: string | null;
  lastVisitDate?: string | null;
  elapsed?: string | null;
  patient: PatientEntity;
};
