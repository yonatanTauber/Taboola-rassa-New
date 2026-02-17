import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/admin";
import { createInviteCode, normalizeInviteEmail } from "@/lib/invite-codes";
import { prisma } from "@/lib/prisma";
import { getRegistrationMode } from "@/lib/registration";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_EXPIRY_DAYS = 14;
const MAX_EXPIRY_DAYS = 365;
const CREATE_RETRIES = 6;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.inviteCode.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      code: true,
      invitedEmail: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      createdAt: true,
      usedByUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    registrationMode: getRegistrationMode(),
    invites: invites.map((invite) => ({
      id: invite.id,
      code: invite.code,
      invitedEmail: invite.invitedEmail,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      usedAt: invite.usedAt?.toISOString() ?? null,
      revokedAt: invite.revokedAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
      usedByUser: invite.usedByUser,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "רק אדמין יכול ליצור הזמנות." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    invitedEmail?: string;
    expiresAt?: string | null;
  };

  const invitedEmailRaw = String(body.invitedEmail ?? "").trim();
  const invitedEmail = invitedEmailRaw ? normalizeInviteEmail(invitedEmailRaw) : null;
  if (invitedEmail && !EMAIL_RE.test(invitedEmail)) {
    return NextResponse.json({ error: "כתובת המייל אינה תקינה." }, { status: 400 });
  }

  const expiresAt = resolveExpiry(body.expiresAt);
  if (expiresAt === "invalid") {
    return NextResponse.json({ error: "תאריך תפוגה אינו תקין." }, { status: 400 });
  }

  for (let attempt = 0; attempt < CREATE_RETRIES; attempt += 1) {
    try {
      const created = await prisma.inviteCode.create({
        data: {
          ownerUserId: user.id,
          code: createInviteCode(),
          invitedEmail,
          expiresAt,
        },
        select: {
          id: true,
          code: true,
          invitedEmail: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
          createdAt: true,
          usedByUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });
      return NextResponse.json({
        ok: true,
        invite: {
          id: created.id,
          code: created.code,
          invitedEmail: created.invitedEmail,
          expiresAt: created.expiresAt?.toISOString() ?? null,
          usedAt: created.usedAt?.toISOString() ?? null,
          revokedAt: created.revokedAt?.toISOString() ?? null,
          createdAt: created.createdAt.toISOString(),
          usedByUser: created.usedByUser,
        },
      });
    } catch (error) {
      if (isUniqueCodeError(error)) continue;
      const message = error instanceof Error ? error.message : "Invite create failed";
      return NextResponse.json({ error: `שגיאת שרת ביצירת הזמנה: ${message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "יצירת קוד הזמנה נכשלה. נסו שוב." }, { status: 500 });
}

function isUniqueCodeError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function resolveExpiry(raw: string | null | undefined): Date | null | "invalid" {
  if (raw == null || String(raw).trim() === "") {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);
    return expiresAt;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "invalid";
  const now = Date.now();
  if (parsed.getTime() <= now) return "invalid";
  const maxFuture = now + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  if (parsed.getTime() > maxFuture) return "invalid";
  return parsed;
}
