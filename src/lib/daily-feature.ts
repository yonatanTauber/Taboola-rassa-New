function parseEnvList(raw: string | undefined) {
  return Array.from(
    new Set(
      String(raw ?? "")
        .split(/[,\n;\s]+/g)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function isTruthy(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isDailyV1EnabledGlobally() {
  return isTruthy(process.env.DAILY_V1_ENABLED);
}

export function canUseDailyV1(email: string | null | undefined) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return false;

  if (isDailyV1EnabledGlobally()) return true;

  const allowedUsers = parseEnvList(process.env.DAILY_V1_USERS);
  return allowedUsers.includes(normalizedEmail);
}

