import { FigureRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const VALID_ROLES: FigureRole[] = [
  "MOTHER", "FATHER", "SISTER", "BROTHER", "PARTNER",
  "FRIEND", "COLLEAGUE", "ACQUAINTANCE", "OTHER",
];

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { patientId?: string; name?: string; role?: string; notes?: string };
  const patientId = String(body.patientId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const roleRaw = String(body.role ?? "OTHER").trim().toUpperCase();
  const role: FigureRole = VALID_ROLES.includes(roleRaw as FigureRole) ? (roleRaw as FigureRole) : "OTHER";
  const notes = String(body.notes ?? "").trim() || null;

  if (!patientId) return NextResponse.json({ error: "חובה לציין מטופל" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "חובה להזין שם" }, { status: 400 });

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId, archivedAt: null },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "מטופל לא נמצא" }, { status: 404 });

  const figure = await prisma.patientFigure.create({
    data: { patientId, name, role, notes },
  });

  return NextResponse.json({ ok: true, figure });
}
