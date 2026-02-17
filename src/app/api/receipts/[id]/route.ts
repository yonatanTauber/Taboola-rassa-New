import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.receipt.findFirst({ where: { id, patient: { ownerUserId: userId } } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.receipt.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({ ok: true, archived: true });
}
