import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac";
import { createAuditLog, getAuditLogData } from "@/lib/audit";

export const dynamic = "force-dynamic";

const templateSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
  narrative: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "TREATMENT_RECORD", "READ");

    const templates = await prisma.recordTemplate.findMany({
      where: { isDeleted: false },
      orderBy: { updatedAt: "desc" },
    });

    const auditData = getAuditLogData(
      request,
      user.id,
      "READ",
      "RECORD_TEMPLATE",
    );
    await createAuditLog({
      ...auditData,
      action: "READ",
      entityType: "RECORD_TEMPLATE",
      category: "DATA_ACCESS",
      metadata: {
        recordCount: templates.length,
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("template list error", error);
    return NextResponse.json(
      { error: "テンプレートの取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "TREATMENT_RECORD", "CREATE");

    const body = await request.json();
    const data = templateSchema.parse(body);

    const created = await prisma.recordTemplate.create({
      data: {
        ...data,
        createdBy: user.id,
      },
    });

    const auditData = getAuditLogData(
      request,
      user.id,
      "CREATE",
      "RECORD_TEMPLATE",
      created.id,
    );
    await createAuditLog({
      ...auditData,
      action: "CREATE",
      entityType: "RECORD_TEMPLATE",
      entityId: created.id,
      category: "DATA_MODIFICATION",
      metadata: {
        title: created.title,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("template create error", error);
    return NextResponse.json(
      { error: "テンプレートの作成に失敗しました" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    await requireApiPermission(user.id, "TREATMENT_RECORD", "DELETE");

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    }

    const existing = await prisma.recordTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 },
      );
    }

    await prisma.recordTemplate.update({
      where: { id },
      data: { isDeleted: true },
    });

    const auditData = getAuditLogData(
      request,
      user.id,
      "DELETE",
      "RECORD_TEMPLATE",
      id,
    );
    await createAuditLog({
      ...auditData,
      action: "DELETE",
      entityType: "RECORD_TEMPLATE",
      entityId: id,
      category: "DATA_MODIFICATION",
      metadata: {
        title: existing.title,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("権限")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("template delete error", error);
    return NextResponse.json(
      { error: "テンプレートの削除に失敗しました" },
      { status: 500 },
    );
  }
}
