import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { patientId?: string; label?: string; href?: string };
  const patientId = String(body.patientId ?? "").trim();
  const label = String(body.label ?? "").trim();
  const href = String(body.href ?? "").trim() || null;

  if (!patientId) return NextResponse.json({ error: "חובה לציין מטופל" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "חובה להזין תווית" }, { status: 400 });

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId, archivedAt: null },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "מטופל לא נמצא" }, { status: 404 });

  const link = await prisma.patientConceptLink.create({
    data: { patientId, label, href },
  });

  return NextResponse.json({ ok: true, link });
}
