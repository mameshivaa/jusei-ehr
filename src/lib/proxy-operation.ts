import { prisma } from "@/lib/prisma";

/**
 * 代行操作レコードを作成（ガイドライン準拠：代行操作の承認機能）
 */
export async function createProxyOperation(
  operatorId: string,
  approverId: string,
  entityType: string,
  entityId: string,
  action: string,
  reason: string,
): Promise<string> {
  const operation = await prisma.proxyOperation.create({
    data: {
      operatorId,
      approverId,
      entityType,
      entityId,
      action,
      reason,
      status: "PENDING",
    },
  });

  return operation.id;
}
