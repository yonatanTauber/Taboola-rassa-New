import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.inviteCode.findFirst({
    where: { id, ownerUserId: userId },
    select: {
      id: true,
      usedAt: true,
      revokedAt: true,
    },
  });

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.usedAt) {
    return NextResponse.json({ error: "לא ניתן לבטל קוד שכבר נוצל." }, { status: 409 });
  }
  if (existing.revokedAt) return NextResponse.json({ ok: true });

  await prisma.inviteCode.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
