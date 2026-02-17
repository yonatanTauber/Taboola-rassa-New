import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, sessionCookieName, sessionMaxAgeSeconds, signSessionToken } from "@/lib/auth";
import { getRegistrationMode, isValidInviteCode, requiresInviteCode } from "@/lib/registration";
import { isExpiredDate, normalizeInviteCode } from "@/lib/invite-codes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
      profession?: string;
      dateOfBirth?: string;
      inviteCode?: string;
    };

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const profession = String(body.profession ?? "").trim();
    const dateOfBirthRaw = String(body.dateOfBirth ?? "").trim();
    const inviteCode = normalizeInviteCode(String(body.inviteCode ?? ""));

    const registrationMode = getRegistrationMode();
    if (registrationMode === "closed") {
      return NextResponse.json({ error: "הרשמה חדשה סגורה כרגע." }, { status: 403 });
    }

    let managedInvite: {
      id: string;
      invitedEmail: string | null;
      expiresAt: Date | null;
      usedAt: Date | null;
      revokedAt: Date | null;
    } | null = null;

    if (requiresInviteCode()) {
      const hasStaticMatch = isValidInviteCode(inviteCode);
      if (!hasStaticMatch) {
        managedInvite = await prisma.inviteCode.findUnique({
          where: { code: inviteCode },
          select: {
            id: true,
            invitedEmail: true,
            expiresAt: true,
            usedAt: true,
            revokedAt: true,
          },
        });
        if (!managedInvite) {
          return NextResponse.json({ error: "קוד ההזמנה לא תקין." }, { status: 403 });
        }
        if (managedInvite.revokedAt) {
          return NextResponse.json({ error: "קוד ההזמנה בוטל." }, { status: 403 });
        }
        if (managedInvite.usedAt) {
          return NextResponse.json({ error: "קוד ההזמנה כבר נוצל." }, { status: 403 });
        }
        if (isExpiredDate(managedInvite.expiresAt)) {
          return NextResponse.json({ error: "קוד ההזמנה פג תוקף." }, { status: 403 });
        }
      }
    }

    if (!fullName || !email || !password) {
      return NextResponse.json({ error: "יש למלא שם מלא, מייל וסיסמה." }, { status: 400 });
    }
    if (managedInvite?.invitedEmail && managedInvite.invitedEmail !== email) {
      return NextResponse.json({ error: "קוד ההזמנה שייך למייל אחר." }, { status: 403 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 8 תווים." }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "קיים כבר משתמש עם כתובת המייל הזו." }, { status: 409 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash: hashPassword(password),
          profession: profession || null,
          dateOfBirth: dateOfBirthRaw ? new Date(dateOfBirthRaw) : null,
        },
        select: { id: true },
      });

      if (managedInvite) {
        const now = new Date();
        const claimed = await tx.inviteCode.updateMany({
          where: {
            id: managedInvite.id,
            usedAt: null,
            revokedAt: null,
            AND: [
              { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              { OR: [{ invitedEmail: null }, { invitedEmail: email }] },
            ],
          },
          data: {
            usedAt: now,
            usedByUserId: created.id,
          },
        });
        if (claimed.count !== 1) {
          throw new Error("INVITE_CLAIM_FAILED");
        }
      }

      return created;
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: sessionCookieName(),
      value: signSessionToken(user.id),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionMaxAgeSeconds(),
      path: "/",
    });
    return res;
  } catch (error) {
    if (error instanceof Error && error.message === "INVITE_CLAIM_FAILED") {
      return NextResponse.json({ error: "קוד ההזמנה אינו זמין יותר. נסו קוד אחר." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: `שגיאת שרת בהרשמה: ${message}` }, { status: 500 });
  }
}
