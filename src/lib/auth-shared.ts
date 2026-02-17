export const SESSION_COOKIE_NAME = "tabula_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 10;

export function getAuthSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return "dev-only-change-me";
}
