import { Prisma } from "@prisma/client";
import { PersonalInfoEncryption } from "@/lib/security/encryption";

export type ChartInsuranceInput = {
  insuranceNumber?: string | null;
  insuranceInsurerNumber?: string | null;
  insuranceCertificateSymbol?: string | null;
  insuranceCertificateNumber?: string | null;
  insuranceExpiryDate?: string | null;
  insuranceEffectiveFrom?: string | null;
  insuranceCopaymentRate?: string | number | null;
  publicAssistanceNumber?: string | null;
  publicAssistanceRecipient?: string | null;
};

export type ChartInsuranceDecrypted = {
  insuranceNumber: string | null;
  insuranceInsurerNumber: string | null;
  insuranceCertificateSymbol: string | null;
  insuranceCertificateNumber: string | null;
  insuranceExpiryDate: string | null;
  insuranceEffectiveFrom: string | null;
  insuranceCopaymentRate: string | null;
  publicAssistanceNumber: string | null;
  publicAssistanceRecipient: string | null;
};

const stringKeys: Array<keyof ChartInsuranceInput> = [
  "insuranceNumber",
  "insuranceInsurerNumber",
  "insuranceCertificateSymbol",
  "insuranceCertificateNumber",
  "publicAssistanceNumber",
  "publicAssistanceRecipient",
];

const dateKeys: Array<keyof ChartInsuranceInput> = [
  "insuranceExpiryDate",
  "insuranceEffectiveFrom",
];

export function normalizeInsuranceInput(
  input: ChartInsuranceInput,
): ChartInsuranceInput {
  const normalized: ChartInsuranceInput = {};
  for (const key of stringKeys) {
    const raw = input[key];
    if (raw === undefined) continue;
    const trimmed = raw === null ? null : String(raw).trim();
    normalized[key] = trimmed ? trimmed : null;
  }

  for (const key of dateKeys) {
    const raw = input[key];
    if (raw === undefined) continue;
    const value = raw === null ? null : String(raw).trim();
    normalized[key] = value || null;
  }

  if (input.insuranceCopaymentRate !== undefined) {
    const rate =
      input.insuranceCopaymentRate === null
        ? null
        : String(input.insuranceCopaymentRate).trim();
    normalized.insuranceCopaymentRate = rate || null;
  }

  return normalized;
}

export function encryptInsuranceFields(input: ChartInsuranceInput) {
  const normalized = normalizeInsuranceInput(input);
  return {
    insuranceNumber: normalized.insuranceNumber
      ? PersonalInfoEncryption.encrypt(normalized.insuranceNumber)
      : null,
    insuranceInsurerNumber: normalized.insuranceInsurerNumber
      ? PersonalInfoEncryption.encrypt(normalized.insuranceInsurerNumber)
      : null,
    insuranceCertificateSymbol: normalized.insuranceCertificateSymbol
      ? PersonalInfoEncryption.encrypt(normalized.insuranceCertificateSymbol)
      : null,
    insuranceCertificateNumber: normalized.insuranceCertificateNumber
      ? PersonalInfoEncryption.encrypt(normalized.insuranceCertificateNumber)
      : null,
    insuranceExpiryDate: normalized.insuranceExpiryDate
      ? new Date(normalized.insuranceExpiryDate)
      : null,
    insuranceEffectiveFrom: normalized.insuranceEffectiveFrom
      ? new Date(normalized.insuranceEffectiveFrom)
      : null,
    insuranceCopaymentRate:
      normalized.insuranceCopaymentRate !== null &&
      normalized.insuranceCopaymentRate !== undefined &&
      normalized.insuranceCopaymentRate !== ""
        ? new Prisma.Decimal(normalized.insuranceCopaymentRate)
        : null,
    publicAssistanceNumber: normalized.publicAssistanceNumber
      ? PersonalInfoEncryption.encrypt(normalized.publicAssistanceNumber)
      : null,
    publicAssistanceRecipient: normalized.publicAssistanceRecipient
      ? PersonalInfoEncryption.encrypt(normalized.publicAssistanceRecipient)
      : null,
  };
}

export function decryptInsuranceFields(
  chart: Partial<{
    insuranceNumber: string | null;
    insuranceInsurerNumber: string | null;
    insuranceCertificateSymbol: string | null;
    insuranceCertificateNumber: string | null;
    insuranceExpiryDate: Date | null;
    insuranceEffectiveFrom: Date | null;
    insuranceCopaymentRate: Prisma.Decimal | null;
    publicAssistanceNumber: string | null;
    publicAssistanceRecipient: string | null;
  }>,
): ChartInsuranceDecrypted {
  return {
    insuranceNumber: chart.insuranceNumber
      ? PersonalInfoEncryption.decrypt(chart.insuranceNumber)
      : null,
    insuranceInsurerNumber: chart.insuranceInsurerNumber
      ? PersonalInfoEncryption.decrypt(chart.insuranceInsurerNumber)
      : null,
    insuranceCertificateSymbol: chart.insuranceCertificateSymbol
      ? PersonalInfoEncryption.decrypt(chart.insuranceCertificateSymbol)
      : null,
    insuranceCertificateNumber: chart.insuranceCertificateNumber
      ? PersonalInfoEncryption.decrypt(chart.insuranceCertificateNumber)
      : null,
    insuranceExpiryDate: chart.insuranceExpiryDate
      ? chart.insuranceExpiryDate.toISOString()
      : null,
    insuranceEffectiveFrom: chart.insuranceEffectiveFrom
      ? chart.insuranceEffectiveFrom.toISOString()
      : null,
    insuranceCopaymentRate: chart.insuranceCopaymentRate
      ? chart.insuranceCopaymentRate.toString()
      : null,
    publicAssistanceNumber: chart.publicAssistanceNumber
      ? PersonalInfoEncryption.decrypt(chart.publicAssistanceNumber)
      : null,
    publicAssistanceRecipient: chart.publicAssistanceRecipient
      ? PersonalInfoEncryption.decrypt(chart.publicAssistanceRecipient)
      : null,
  };
}

export function mergeInsuranceDefaults(
  incoming: ChartInsuranceInput,
  fallback: ChartInsuranceDecrypted | null,
): ChartInsuranceInput {
  if (!fallback) return incoming;
  const merged: ChartInsuranceInput = { ...incoming };
  for (const key of [
    "insuranceNumber",
    "insuranceInsurerNumber",
    "insuranceCertificateSymbol",
    "insuranceCertificateNumber",
    "insuranceExpiryDate",
    "insuranceEffectiveFrom",
    "insuranceCopaymentRate",
    "publicAssistanceNumber",
    "publicAssistanceRecipient",
  ] as const) {
    if (
      merged[key] === undefined ||
      merged[key] === null ||
      merged[key] === ""
    ) {
      merged[key] = fallback[key];
    }
  }
  return merged;
}
