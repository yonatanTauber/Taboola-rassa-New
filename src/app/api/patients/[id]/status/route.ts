import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import {
  parseRequiredDate,
  PatientStatusError,
  reactivatePatientById,
  setPatientInactiveById,
} from "@/lib/patient-status";

function toBoolean(value: unknown) {
  return value === true;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();

  try {
    if (action === "set_inactive") {
      const inactiveAt = parseRequiredDate(body?.inactiveAt, "תאריך מעבר ללא פעיל");
      const result = await setPatientInactiveById({
        patientId: id,
        actorUserId: userId,
        inactiveAt,
        reason: typeof body?.reason === "string" ? body.reason : null,
        cancelFutureSessions: toBoolean(body?.cancelFutureSessions),
        closeOpenTasks: toBoolean(body?.closeOpenTasks),
      });

      revalidatePath("/patients");
      revalidatePath(`/patients/${id}`);
      revalidatePath("/tasks");
      revalidatePath("/sessions");
      revalidatePath("/inquiries");

      return NextResponse.json({
        ok: true,
        status: result.status,
        patientId: result.patientId,
        canceledSessionsCount: result.canceledSessionsCount,
        closedTasksCount: result.closedTasksCount,
      });
    }

    if (action === "reactivate") {
      const reactivatedAt = parseRequiredDate(body?.reactivatedAt, "תאריך חזרה לטיפול");
      const reason = String(body?.reason ?? "").trim();
      if (!reason) {
        return NextResponse.json({ error: "חובה להזין סיבת חזרה לטיפול." }, { status: 400 });
      }

      const result = await reactivatePatientById({
        patientId: id,
        actorUserId: userId,
        reactivatedAt,
        reason,
      });

      revalidatePath("/patients");
      revalidatePath(`/patients/${id}`);
      revalidatePath("/tasks");
      revalidatePath("/sessions");
      revalidatePath("/inquiries");

      return NextResponse.json({
        ok: true,
        status: result.status,
        patientId: result.patientId,
      });
    }

    return NextResponse.json({ error: "פעולה לא נתמכת." }, { status: 400 });
  } catch (error) {
    if (error instanceof PatientStatusError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "עדכון סטטוס המטופל נכשל." }, { status: 500 });
  }
}
