import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { reactivatePatientById, PatientStatusError } from "@/lib/patient-status";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;

  try {
    await reactivatePatientById({
      patientId: id,
      actorUserId: userId,
      reactivatedAt: new Date(),
      reason: "הפעלה מחדש מדף הארכיון",
    });
  } catch (error) {
    if (error instanceof PatientStatusError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "הפעלת המטופל מחדש נכשלה." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reactivated: true });
}
