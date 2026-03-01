import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { generateUpcomingSessions } from "@/lib/recurring-sessions";

/**
 * POST /api/admin/regenerate-recurring
 *
 * Regenerates all upcoming recurring sessions for the current user's patients.
 * Steps per patient:
 *   1. Delete future SCHEDULED sessions that are recurring templates.
 *   2. Re-create them using the corrected day-of-week logic.
 *
 * Returns: { ok, patients, totalDeleted, totalCreated }
 */
export async function POST() {
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }

  // Find all active patients belonging to this user that have a recurring schedule
  const patients = await prisma.patient.findMany({
    where: {
      ownerUserId: userId,
      fixedSessionDay: { not: null },
      fixedSessionTime: { not: null },
      archivedAt: null,
    },
    select: {
      id: true,
      fixedSessionDay: true,
      fixedSessionTime: true,
    },
  });

  let totalDeleted = 0;
  let totalCreated = 0;

  for (const patient of patients) {
    if (patient.fixedSessionDay === null || !patient.fixedSessionTime) continue;

    // Delete all future SCHEDULED recurring-template sessions for this patient
    const deleted = await prisma.session.deleteMany({
      where: {
        patientId: patient.id,
        isRecurringTemplate: true,
        status: "SCHEDULED",
        scheduledAt: { gt: new Date() },
      },
    });
    totalDeleted += deleted.count;

    // Regenerate sessions with corrected day-of-week logic
    const { dates } = await generateUpcomingSessions(
      patient.id,
      { fixedSessionDay: patient.fixedSessionDay, fixedSessionTime: patient.fixedSessionTime },
      prisma
    );

    await Promise.all(
      dates.map((date) =>
        prisma.session.create({
          data: {
            patientId: patient.id,
            scheduledAt: date,
            status: "SCHEDULED",
            isRecurringTemplate: true,
          },
        })
      )
    );

    totalCreated += dates.length;
  }

  return NextResponse.json({
    ok: true,
    patients: patients.length,
    totalDeleted,
    totalCreated,
  });
}
