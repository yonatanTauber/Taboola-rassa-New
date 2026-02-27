import { SessionStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

/**
 * Return the next occurrence of weekday from startDate
 * weekday: 0=Sun, 1=Mon, ..., 6=Sat
 * Returns the next date with same weekday >= startDate
 */
export function getDateOfWeekday(startDate: Date, weekday: number): Date {
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const dayDiff = (weekday - current.getDay() + 7) % 7;

  if (dayDiff === 0) {
    // Same weekday — check if we should use this week or next week
    // Use this week if start date hasn't occurred yet, else next week
    if (current.getTime() < startDate.getTime()) {
      // Current is at midnight, startDate is after midnight
      // Use this week's occurrence
      return current;
    } else {
      // Use next week
      current.setDate(current.getDate() + 7);
      return current;
    }
  } else {
    current.setDate(current.getDate() + dayDiff);
    return current;
  }
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
  const expectedDate = getDateOfWeekday(newSessionDate, patient.fixedSessionDay);
  const expectedTime = new Date(expectedDate);
  expectedTime.setHours(fixedHour, fixedMinute, 0, 0);

  const newTime = new Date(newSessionDate);
  newTime.setHours(newSessionHour, newSessionMinute, 0, 0);

  const diffSeconds = Math.abs(newTime.getTime() - expectedTime.getTime()) / 1000;
  const MERGE_THRESHOLD_SECONDS = 30 * 60; // 30 minutes

  if (diffSeconds <= MERGE_THRESHOLD_SECONDS) {
    // Time is close enough — check if we should suggest same-day merge
    const sameDayCandidate = existingSessions.find(
      (s) =>
        s.scheduledAt.toDateString() === newSessionDate.toDateString() &&
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
 * Avoids duplicates (checks existing sessions)
 * Returns array of dates to create
 */
export async function generateUpcomingSessions(
  patientId: string,
  patient: {
    fixedSessionDay: number | null;
    fixedSessionTime: string | null;
  },
  prisma: PrismaClient
): Promise<{ dates: Date[]; summary: string }> {
  if (!patient.fixedSessionDay || !patient.fixedSessionTime) {
    return { dates: [], summary: "No recurring schedule set" };
  }

  const now = new Date();
  const [hour, minute] = patient.fixedSessionTime.split(":").map(Number);
  const futureRange = new Date(now);
  futureRange.setDate(futureRange.getDate() + 30);

  const sessions: Date[] = [];
  let current = getDateOfWeekday(now, patient.fixedSessionDay);

  // Get existing sessions to avoid duplicates
  const existing = await prisma.session.findMany({
    where: {
      patientId,
      scheduledAt: { gte: now, lte: futureRange },
    },
    select: { scheduledAt: true },
  });

  const existingDates = new Set(
    existing.map((s) => s.scheduledAt.toISOString().split("T")[0])
  );

  while (current <= futureRange) {
    const dateStr = current.toISOString().split("T")[0];
    if (!existingDates.has(dateStr)) {
      const sessionTime = new Date(current);
      sessionTime.setHours(hour, minute, 0, 0);
      sessions.push(sessionTime);
    }
    current.setDate(current.getDate() + 7); // Next week
  }

  return {
    dates: sessions,
    summary: `Generated ${sessions.length} upcoming sessions`,
  };
}
