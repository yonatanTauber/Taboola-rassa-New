import { FigureRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const VALID_ROLES: FigureRole[] = [
  "MOTHER", "FATHER", "SISTER", "BROTHER", "PARTNER",
  "FRIEND", "COLLEAGUE", "ACQUAINTANCE", "OTHER",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const figure = await prisma.patientFigure.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!figure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ figure });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json()) as { name?: string; role?: string; notes?: string };

  const existing = await prisma.patientFigure.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    select: { id: true, name: true, role: true, notes: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name = typeof body.name === "string" ? body.name.trim() : existing.name;
  const roleRaw = typeof body.role === "string" ? body.role.trim().toUpperCase() : existing.role;
  const role: FigureRole = VALID_ROLES.includes(roleRaw as FigureRole) ? (roleRaw as FigureRole) : "OTHER";
  const notes = typeof body.notes === "string" ? (body.notes.trim() || null) : existing.notes;

  if (!name) return NextResponse.json({ error: "חובה להזין שם" }, { status: 400 });

  const updated = await prisma.patientFigure.update({
    where: { id },
    data: { name, role, notes },
  });

  return NextResponse.json({ ok: true, figure: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.patientFigure.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.patientFigure.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
