import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { getAuthSecret, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth-shared";

export function sessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function sessionMaxAgeSeconds() {
  return SESSION_TTL_SECONDS;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const iterations = 120000;
  const digest = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2$${iterations}$${salt}$${digest}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [scheme, iterationsRaw, salt, digest] = encoded.split("$");
  if (scheme !== "pbkdf2" || !iterationsRaw || !salt || !digest) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const candidate = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const stored = Buffer.from(digest, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export function signSessionToken(userId: string) {
  const secret = getAuthSecret();
  const now = Date.now();
  const payload = JSON.stringify({
    uid: userId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS * 1000,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function readSessionToken(token: string | undefined) {
  if (!token) return null;
  const secret = getAuthSecret();
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { uid?: string; iat?: number; exp?: number };
  if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null;
  return { userId: payload.uid, issuedAt: payload.iat ?? 0 };
}
