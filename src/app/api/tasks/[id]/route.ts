import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.task.findFirst({
    where: {
      id,
      OR: [
        { ownerUserId: userId },
        { patient: { ownerUserId: userId } },
        { session: { patient: { ownerUserId: userId } } },
      ],
    },
  });
  if (!existing) return NextResponse.json({ error: "המשימה לא נמצאה." }, { status: 404 });

  if (typeof body.patientId === "string" && body.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: body.patientId, ownerUserId: userId, archivedAt: null },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "לא ניתן לשייך משימה למטופל לא פעיל או לא קיים." }, { status: 400 });
    }
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: typeof body.title === "string" ? body.title : undefined,
      details: typeof body.details === "string" ? body.details : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      completedAt:
        body.status === "DONE"
          ? new Date()
          : body.status === "OPEN" || body.status === "CANCELED"
            ? null
            : undefined,
      patientId: body.patientId === "" ? null : typeof body.patientId === "string" ? body.patientId : undefined,
      dueAt: body.dueAt === "" ? null : typeof body.dueAt === "string" ? new Date(body.dueAt) : undefined,
      reminderAt:
        body.reminderAt === ""
          ? null
          : typeof body.reminderAt === "string"
            ? new Date(body.reminderAt)
            : undefined,
    },
  });

  return NextResponse.json({ ok: true, task: updated, previous: existing });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.task.findFirst({
    where: {
      id,
      OR: [
        { ownerUserId: userId },
        { patient: { ownerUserId: userId } },
        { session: { patient: { ownerUserId: userId } } },
      ],
    },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "המשימה לא נמצאה." }, { status: 404 });
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
