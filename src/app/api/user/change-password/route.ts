import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { requireCurrentUserId } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "לא מחובר." }, { status: 401 });
  }

  const body = (await req.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "יש להזין סיסמה נוכחית וסיסמה חדשה." }, { status: 400 });
  }

  if (newPassword.length < 10) {
    return NextResponse.json({ error: "הסיסמה החדשה חייבת להכיל לפחות 10 תווים." }, { status: 400 });
  }
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
    return NextResponse.json({ error: "הסיסמה החדשה חייבת להכיל לפחות מספר אחד או תו מיוחד." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "הסיסמה הנוכחית שגויה." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: hashPassword(newPassword),
      passwordChangedAt: new Date(),
    },
  });

  await logAudit({ action: "EDIT_PATIENT", userId, resourceType: "user", req });

  return NextResponse.json({ ok: true });
}
