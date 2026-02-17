import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/auth";

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  const parsed = readSessionToken(token);
  if (!parsed) return null;
  return prisma.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, fullName: true, email: true, profession: true },
  });
}

export async function requireCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
