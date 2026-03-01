import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/sessions/[id]/merge-recurring
 *
 * Moves a session to match the patient's recurring schedule time.
 * Uses the session's date but replaces the time with the patient's fixed time.
 * Returns the updated scheduledAt time.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }

  const { id } = await params;

  const session = await prisma.session.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: { patient: true },
  });

  if (!session) {
    return NextResponse.json({ error: "סשן לא נמצא" }, { status: 404 });
  }

  if (!session.patient.fixedSessionDay || !session.patient.fixedSessionTime) {
    return NextResponse.json(
      { error: "למטופל אין מועד פגישה קבוע" },
      { status: 400 }
    );
  }

  // Get the date string in Israel timezone
  const TZ = "Asia/Jerusalem";
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    dateStyle: "short",
  }).format(session.scheduledAt);

  const [fixedHour, fixedMinute] = session.patient.fixedSessionTime
    .split(":")
    .map(Number);

  // Build the new time using the same approach as buildIsraelDateTime
  // Reference: get offset from noon UTC
  const refDate = new Date(`${dateStr}T12:00:00Z`);
  const israelNoon = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(refDate);
  const [israelHourStr] = israelNoon.split(":");
  const israelHour = parseInt(israelHourStr, 10);
  const offsetHours = israelHour - 12;

  // Build UTC time with offset
  const utcDate = new Date(
    `${dateStr}T${String(fixedHour).padStart(2, "0")}:${String(fixedMinute).padStart(2, "0")}:00Z`
  );
  utcDate.setUTCHours(utcDate.getUTCHours() - offsetHours);

  // Update the session
  const updated = await prisma.session.update({
    where: { id },
    data: { scheduledAt: utcDate },
  });

  return NextResponse.json({
    ok: true,
    scheduledAt: updated.scheduledAt.toISOString(),
  });
}
