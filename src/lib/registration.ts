import { timingSafeEqual } from "crypto";

export type RegistrationMode = "open" | "invite" | "closed";

export function getRegistrationMode(): RegistrationMode {
  const raw = String(process.env.REGISTRATION_MODE ?? "").trim().toLowerCase();
  if (raw === "open" || raw === "invite" || raw === "closed") return raw;
  return process.env.NODE_ENV === "production" ? "invite" : "open";
}

export function isRegistrationAllowed() {
  return getRegistrationMode() !== "closed";
}

export function requiresInviteCode() {
  return getRegistrationMode() === "invite";
}

export function isValidInviteCode(rawCode: string) {
  if (!requiresInviteCode()) return true;
  const input = rawCode.trim().toUpperCase();
  if (!input) return false;
  const configured = getConfiguredInviteCodes();
  return configured.some((candidate) => safeEqual(candidate, input));
}

function getConfiguredInviteCodes() {
  return String(process.env.INVITE_CODES ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
