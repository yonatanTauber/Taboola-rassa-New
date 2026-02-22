/**
 * Date/time formatting helpers.
 *
 * Always specify timeZone: "Asia/Jerusalem" so that these functions produce
 * correct output regardless of where they are called (browser OR Node.js on
 * Vercel which runs in UTC). Prisma returns Date objects whose UTC value is
 * stored in the database; without an explicit timeZone these would display in
 * UTC (e.g. 09:00) instead of the local Israel time (e.g. 11:00).
 */

const TZ = "Asia/Jerusalem";

/** "11:00" */
export function fmtTime(date: Date): string {
  return date.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** "22.02.2026" */
export function fmtDate(date: Date): string {
  return date.toLocaleDateString("he-IL", { timeZone: TZ });
}

/** "22.02" */
export function fmtDateShort(date: Date): string {
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ,
  });
}

/** "22.02.2026 · 11:00" */
export function fmtDateTime(date: Date): string {
  return `${fmtDate(date)} · ${fmtTime(date)}`;
}
