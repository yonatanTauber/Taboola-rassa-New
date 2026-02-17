import { TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const dueAtRaw = String(body.dueAt ?? "").trim();
  const reminderAtRaw = String(body.reminderAt ?? "").trim();
  const patientId = String(body.patientId ?? "").trim();

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  if (patientId) {
    const patient = await prisma.patient.findFirst({ where: { id: patientId, ownerUserId: userId }, select: { id: true } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const task = await prisma.task.create({
    data: {
      ownerUserId: userId,
      title,
      dueAt: dueAtRaw ? new Date(dueAtRaw) : null,
      reminderAt: reminderAtRaw ? new Date(reminderAtRaw) : null,
      patientId: patientId || null,
      status: TaskStatus.OPEN,
    },
  });

  return NextResponse.json({ ok: true, taskId: task.id });
}
