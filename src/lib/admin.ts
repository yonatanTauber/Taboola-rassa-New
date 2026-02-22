export function isAdminEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const configured = getConfiguredAdminEmails();
  if (configured.length === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return configured.includes(normalized);
}

function getConfiguredAdminEmails() {
  const raw = [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(",");

  return Array.from(
    new Set(
      raw
        .split(/[,\n;\s]+/g)
        .map((item) => item.replace(/^["']+|["']+$/g, ""))
        .map((item) => normalizeEmail(item))
        .filter(Boolean),
    ),
  );
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}
