export function isAdminEmail(email: string | null | undefined) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return false;

  const configured = getConfiguredAdminEmails();
  if (configured.length === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return configured.includes(normalized);
}

function getConfiguredAdminEmails() {
  return String(process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}
