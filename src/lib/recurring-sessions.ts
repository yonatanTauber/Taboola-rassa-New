import { SessionStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const TZ = "Asia/Jerusalem";

/**
 * Get today's date string in Israel timezone (YYYY-MM-DD)
 */
function toIsraelDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, dateStyle: "short" }).format(date);
}

/**
 * Get the weekday (0=Sun, 1=Mon, ..., 6=Sat) in Israel timezone
 */
function getIsraelWeekday(date: Date): number {
  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return days[dayName] ?? 0;
}

/**
 * Build a UTC Date for a given Israel-local date + hour + minute.
 * e.g. date "2025-02-25" + hour 15 + minute 30 in Asia/Jerusalem → UTC Date
 */
function buildIsraelDateTime(dateStr: string, hour: number, minute: number): Date {
  // Parse as local Israel time by constructing a reference timestamp
  // We use the trick: parse midnight UTC for that date, then find the Israel offset
  const naive = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
  // naive is interpreted as LOCAL time of the server — instead, build proper UTC
  // by using the Intl offset approach
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(naive);

  // If we just need to create a time in Israel tz from a known date+hour+minute,
  // we can use the offset from a reference point:
  const refDate = new Date(`${dateStr}T12:00:00Z`); // noon UTC as reference
  const israelNoon = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(refDate);
  const [israelHourStr] = israelNoon.split(":");
  const israelHour = parseInt(israelHourStr, 10);
  // offset in hours: israelHour - 12 (since reference is noon UTC)
  const offsetHours = israelHour - 12;

  // Build the target UTC time
  const utcDate = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  utcDate.setUTCHours(utcDate.getUTCHours() - offsetHours);
  return utcDate;
}

/**
 * Return the next occurrence of weekday from startDate (in Israel timezone)
 * weekday: 0=Sun, 1=Mon, ..., 6=Sat
 * Returns the next Israel date string (YYYY-MM-DD) with that weekday >= startDate
 */
export function getDateOfWeekday(startDate: Date, weekday: number): Date {
  const startStr = toIsraelDateStr(startDate);
  const current = new Date(`${startStr}T00:00:00Z`);

  const currentWeekday = getIsraelWeekday(current);
  let dayDiff = (weekday - currentWeekday + 7) % 7;

  if (dayDiff === 0) {
    // Same weekday — always use next week (startDate is "now", so this week's is past/current)
    dayDiff = 7;
  }

  current.setUTCDate(current.getUTCDate() + dayDiff);
  return current;
}

/**
 * Merge suggestion interface
 */
export interface MergeSuggestion {
  shouldMerge: boolean;
  mergeCandidateId?: string;
  expectedTime: Date;
  timeDifference?: number; // seconds
}

/**
 * Detect if a newly created session should be merged with an existing recurring session
 * Returns merge suggestion with time difference
 */
export function detectPotentialMerge(
  newSessionDate: Date,
  newSessionHour: number,
  newSessionMinute: number,
  patient: { fixedSessionDay?: number | null; fixedSessionTime?: string | null },
  existingSessions: Array<{ id: string; scheduledAt: Date; status: SessionStatus }>
): MergeSuggestion {
  if (!patient.fixedSessionDay || !patient.fixedSessionTime) {
    return { shouldMerge: false, expectedTime: newSessionDate };
  }

  const [fixedHour, fixedMinute] = patient.fixedSessionTime
    .split(":")
    .map(Number);

  const newDateStr = toIsraelDateStr(newSessionDate);
  const expectedDate = getDateOfWeekday(newSessionDate, patient.fixedSessionDay);
  const expectedDateStr = toIsraelDateStr(expectedDate);
  const expectedTime = buildIsraelDateTime(expectedDateStr, fixedHour, fixedMinute);
  const newTime = buildIsraelDateTime(newDateStr, newSessionHour, newSessionMinute);

  const diffSeconds = Math.abs(newTime.getTime() - expectedTime.getTime()) / 1000;
  const MERGE_THRESHOLD_SECONDS = 30 * 60; // 30 minutes

  if (diffSeconds <= MERGE_THRESHOLD_SECONDS) {
    // Time is close enough — check if we should suggest same-day merge
    const sameDayCandidate = existingSessions.find(
      (s) =>
        toIsraelDateStr(s.scheduledAt) === newDateStr &&
        Math.abs(s.scheduledAt.getTime() - newTime.getTime()) <=
          MERGE_THRESHOLD_SECONDS * 1000
    );

    return {
      shouldMerge: true,
      mergeCandidateId: sameDayCandidate?.id,
      expectedTime,
      timeDifference: diffSeconds,
    };
  }

  return { shouldMerge: false, expectedTime };
}

/**
 * Generate upcoming recurring sessions for a patient
 * Respects: fixedSessionDay, fixedSessionTime
 * Avoids duplicates (checks existing sessions by Israel date string)
 * Returns array of UTC dates to create
 */
export async function generateUpcomingSessions(
  patientId: string,
  patient: {
    fixedSessionDay: number | null;
    fixedSessionTime: string | null;
  },
  prisma: PrismaClient
): Promise<{ dates: Date[]; summary: string }> {
  if (patient.fixedSessionDay === null || !patient.fixedSessionTime) {
    return { dates: [], summary: "No recurring schedule set" };
  }

  const now = new Date();
  const [hour, minute] = patient.fixedSessionTime.split(":").map(Number);
  const futureRange = new Date(now);
  futureRange.setDate(futureRange.getDate() + 30);

  // Get existing sessions to avoid duplicates
  const existing = await prisma.session.findMany({
    where: {
      patientId,
      scheduledAt: { gte: now, lte: futureRange },
    },
    select: { scheduledAt: true },
  });

  const existingDates = new Set(
    existing.map((s) => toIsraelDateStr(s.scheduledAt))
  );

  const sessions: Date[] = [];

  // Start from the next occurrence of the fixed weekday
  let currentDateStr = toIsraelDateStr(now);
  let currentUTC = new Date(`${currentDateStr}T00:00:00Z`);

  // Find the first occurrence of the fixed weekday on or after today
  const currentWeekday = getIsraelWeekday(currentUTC);
  let dayDiff = (patient.fixedSessionDay - currentWeekday + 7) % 7;
  if (dayDiff === 0) {
    // Check if today's session time has already passed
    const todaySession = buildIsraelDateTime(currentDateStr, hour, minute);
    if (todaySession <= now) {
      dayDiff = 7; // Move to next week
    }
  }
  currentUTC.setUTCDate(currentUTC.getUTCDate() + dayDiff);

  while (currentUTC <= futureRange) {
    const dateStr = toIsraelDateStr(currentUTC);
    if (!existingDates.has(dateStr)) {
      const sessionTime = buildIsraelDateTime(dateStr, hour, minute);
      sessions.push(sessionTime);
    }
    currentUTC.setUTCDate(currentUTC.getUTCDate() + 7); // Next week
  }

  return {
    dates: sessions,
    summary: `Generated ${sessions.length} upcoming sessions`,
  };
}
