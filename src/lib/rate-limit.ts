type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

function getClientIp(req: Request): string {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function check(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// 5 ניסיונות login ב-15 דקות
export function checkLoginRateLimit(req: Request) {
  const ip = getClientIp(req);
  return check(`login:${ip}`, 5, 15 * 60 * 1000);
}

// 3 הרשמות לשעה
export function checkRegisterRateLimit(req: Request) {
  const ip = getClientIp(req);
  return check(`register:${ip}`, 3, 60 * 60 * 1000);
}
