import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DigitalSignature } from "@/lib/security/digital-signature";

/**
 * e-文書法対応：施術記録の電子署名検証
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAuth();

    const record = await prisma.treatmentRecord.findUnique({
      where: { id: params.id, isDeleted: false },
    });

    if (!record) {
      return NextResponse.json(
        { error: "施術記録が見つかりません" },
        { status: 404 },
      );
    }

    if (!record.digitalSignature || !record.timestampHash) {
      return NextResponse.json({
        verified: false,
        message: "電子署名またはタイムスタンプが記録されていません",
      });
    }

    // 記録内容を文字列化
    const recordContent = JSON.stringify({
      id: record.id,
      visitId: record.visitId,
      narrative: record.narrative,
      version: record.version,
    });

    // 電子署名を検証
    const signature = JSON.parse(record.digitalSignature);
    const verified = DigitalSignature.verify(
      recordContent,
      signature.signature,
      signature.timestamp,
      signature.algorithm,
    );

    // タイムスタンプの検証
    const timestampVerified =
      record.timestampHash ===
      DigitalSignature.calculateHash(record.confirmedAt?.toISOString() || "");

    return NextResponse.json({
      verified: verified && timestampVerified,
      signature: {
        algorithm: signature.algorithm,
        timestamp: signature.timestamp,
        hash: signature.hash,
      },
      timestamp: {
        hash: record.timestampHash,
        source: record.timestampSource,
        verified: timestampVerified,
      },
      confirmedAt: record.confirmedAt,
      confirmedBy: record.confirmedBy,
    });
  } catch (error) {
    console.error("Signature verification error:", error);
    return NextResponse.json(
      { error: "電子署名の検証に失敗しました" },
      { status: 500 },
    );
  }
}
