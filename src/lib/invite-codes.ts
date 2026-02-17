import { randomBytes } from "crypto";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInviteCode(raw: string) {
  return raw.trim().toUpperCase();
}

export function normalizeInviteEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function createInviteCode() {
  const bytes = randomBytes(10);
  let token = "";
  for (const value of bytes) {
    token += INVITE_ALPHABET[value % INVITE_ALPHABET.length];
  }
  return `${token.slice(0, 5)}-${token.slice(5, 10)}`;
}

export function isExpiredDate(expiresAt: Date | null | undefined, now = new Date()) {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}
