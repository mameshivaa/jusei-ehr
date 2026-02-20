import { prisma } from "@/lib/prisma";
import { computeChainHash } from "@/lib/security/hash-chain";

type TreatmentRecordData = {
  narrative?: string | null;
  injuryId?: string | null;
};

/**
 * 施術記録の更新履歴を記録します（ガイドライン準拠：更新履歴の保管）
 */
export async function createTreatmentRecordHistory(
  recordId: string,
  oldData: TreatmentRecordData,
  newData: TreatmentRecordData,
  changedBy: string,
  changeType: "CREATE" | "UPDATE" | "DELETE" | "CONFIRM",
  version: number,
  changeReason?: string,
): Promise<void> {
  try {
    const changedAt = new Date();
    const beforeData = {
      narrative: oldData.narrative ?? null,
      injuryId: oldData.injuryId ?? null,
    };
    const afterData = {
      narrative: newData.narrative ?? null,
      injuryId: newData.injuryId ?? null,
    };

    const lastHistory = await prisma.treatmentRecordHistory.findFirst({
      where: { recordId },
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
      select: { hash: true },
    });
    const prevHash = lastHistory?.hash || null;

    const payload = {
      recordId,
      operation: changeType,
      version,
      changedBy,
      changeReason: changeReason || null,
      serverReceivedAt: changedAt.toISOString(),
      beforeData,
      afterData,
    };
    const { hash } = computeChainHash(prevHash, payload);

    await prisma.treatmentRecordHistory.create({
      data: {
        recordId,
        narrative: oldData.narrative || null,
        beforeData,
        afterData,
        version,
        changedBy,
        changeType,
        changeReason: changeReason || null,
        changedAt,
        prevHash,
        hash,
      },
    });
  } catch (error) {
    console.error("Failed to create treatment record history:", error);
  }
}
