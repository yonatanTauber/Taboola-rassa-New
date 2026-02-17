import { PatientState, SessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const patientId = String(body.patientId ?? "").trim();
  const scheduledAtRaw = String(body.scheduledAt ?? "").trim();
  const location = String(body.location ?? "").trim();
  const feeNis = Number(body.feeNis ?? 0);
  const note = String(body.note ?? "").trim();

  if (!patientId || !scheduledAtRaw) {
    return NextResponse.json({ error: "Missing patientId or scheduledAt" }, { status: 400 });
  }
  const patient = await prisma.patient.findFirst({ where: { id: patientId, ownerUserId: userId }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const scheduledAt = new Date(scheduledAtRaw);
  const status =
    note.length > 0 && scheduledAt.getTime() <= Date.now()
      ? SessionStatus.COMPLETED
      : SessionStatus.SCHEDULED;

  const session = await prisma.session.create({
    data: {
      patientId,
      scheduledAt,
      status,
      location: location || null,
      feeNis: Number.isFinite(feeNis) && feeNis > 0 ? feeNis : null,
      patientState: PatientState.NO_CHANGE,
      sessionNote: note
        ? {
            create: {
              markdown: note,
            },
          }
        : undefined,
    },
  });

  return NextResponse.json({ ok: true, sessionId: session.id });
}
