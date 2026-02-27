import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { patientId?: string; title?: string; content?: string };
  const patientId = String(body.patientId ?? "").trim();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();

  if (!patientId) return NextResponse.json({ error: "חובה לציין מטופל" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "חובה להזין כותרת" }, { status: 400 });

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId, archivedAt: null },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "מטופל לא נמצא" }, { status: 404 });

  const note = await prisma.patientNote.create({
    data: { patientId, title, content: content || "" },
  });

  return NextResponse.json({ ok: true, note });
}
