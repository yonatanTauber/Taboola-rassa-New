import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "רק אדמין יכול לבטל הזמנות." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.inviteCode.findFirst({
    where: { id, ownerUserId: user.id },
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
