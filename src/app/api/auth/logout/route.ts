import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth";
import { requireCurrentUserId } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (userId) {
    await logAudit({ action: "LOGOUT", userId, req });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: sessionCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return res;
}
