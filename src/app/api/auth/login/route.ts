import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCookieName, sessionMaxAgeSeconds, signSessionToken, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ error: "יש להזין מייל וסיסמה." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "מייל או סיסמה שגויים." }, { status: 401 });
    }

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
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: `שגיאת שרת בהתחברות: ${message}` }, { status: 500 });
  }
}
