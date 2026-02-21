import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/auth";

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  const parsed = readSessionToken(token);
  if (!parsed) return null;
  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, fullName: true, email: true, profession: true, defaultSessionFeeNis: true, passwordChangedAt: true },
  });
  if (!user) return null;
  // בטל session אם הסיסמה שונתה אחרי שהוא הונפק
  if (user.passwordChangedAt && parsed.issuedAt < user.passwordChangedAt.getTime()) return null;
  const { passwordChangedAt: _, ...userWithoutSensitive } = user;
  return userWithoutSensitive;
}

export async function requireCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
