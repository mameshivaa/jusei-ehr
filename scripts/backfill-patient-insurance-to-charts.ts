import { PrismaClient } from "@prisma/client";
import { encryptInsuranceFields } from "../src/lib/charts/insurance";
import { PersonalInfoEncryption } from "../src/lib/security/encryption";
import { ACTIVE_CHART_STATUS } from "../src/lib/charts/status";

const prisma = new PrismaClient();

type PatientInsuranceRow = {
  id: string;
  insuranceNumber: string | null;
};

async function hasPatientInsuranceColumn(): Promise<boolean> {
  const columns = (await prisma.$queryRaw<
    Array<{ name: string }>
  >`PRAGMA table_info('patients')`) as Array<{ name: string }>;
  return columns.some((col) => col.name === "insuranceNumber");
}

async function backfillInsuranceToCharts() {
  console.log("Checking for legacy patient insurance column...");
  const hasColumn = await hasPatientInsuranceColumn();
  if (!hasColumn) {
    console.log("legacy column insuranceNumber not found on patients. Skip.");
    return;
  }

  const patients = (await prisma.$queryRaw<
    PatientInsuranceRow[]
  >`SELECT id, insuranceNumber FROM patients WHERE insuranceNumber IS NOT NULL AND insuranceNumber != ''`) as PatientInsuranceRow[];

  console.log(`Found ${patients.length} patients with legacy insurance data.`);

  for (const patient of patients) {
    if (!patient.insuranceNumber) continue;
    await prisma.$transaction(async (tx) => {
      const chart =
        (await tx.chart.findFirst({
          where: { patientId: patient.id },
          orderBy: { createdAt: "desc" },
        })) ??
        (await tx.chart.create({
          data: {
            patientId: patient.id,
            status: ACTIVE_CHART_STATUS,
          },
        }));

      let plainInsurance = patient.insuranceNumber;
      try {
        if (plainInsurance) {
          plainInsurance = PersonalInfoEncryption.decrypt(plainInsurance);
        }
      } catch {
        // treat as already plain
      }

      const encrypted = encryptInsuranceFields({
        insuranceNumber: plainInsurance,
      });

      await tx.chart.update({
        where: { id: chart.id },
        data: {
          ...encrypted,
        },
      });
    });
  }

  console.log("Backfill complete.");
}

async function main() {
  try {
    await backfillInsuranceToCharts();
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Backfill failed", error);
    process.exit(1);
  });
}
