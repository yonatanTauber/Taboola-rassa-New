import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, sessionCookieName, sessionMaxAgeSeconds, signSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
      profession?: string;
      dateOfBirth?: string;
    };

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const profession = String(body.profession ?? "").trim();
    const dateOfBirthRaw = String(body.dateOfBirth ?? "").trim();

    if (!fullName || !email || !password) {
      return NextResponse.json({ error: "יש למלא שם מלא, מייל וסיסמה." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 8 תווים." }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "קיים כבר משתמש עם כתובת המייל הזו." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash: hashPassword(password),
        profession: profession || null,
        dateOfBirth: dateOfBirthRaw ? new Date(dateOfBirthRaw) : null,
      },
      select: { id: true },
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
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: `שגיאת שרת בהרשמה: ${message}` }, { status: 500 });
  }
}
