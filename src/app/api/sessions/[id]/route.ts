import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.session.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: { sessionNote: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.session.update({
    where: { id },
    data: {
      status: typeof body.status === "string" ? body.status : undefined,
      location: body.location === "" ? null : typeof body.location === "string" ? body.location : undefined,
      feeNis:
        body.feeNis === ""
          ? null
          : typeof body.feeNis === "number"
            ? body.feeNis
            : undefined,
      scheduledAt: typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : undefined,
    },
    include: { sessionNote: true },
  });

  if (typeof body.note === "string") {
    if (updated.sessionNote) {
      await prisma.sessionNote.update({
        where: { sessionId: id },
        data: { markdown: body.note },
      });
    } else if (body.note.trim()) {
      await prisma.sessionNote.create({ data: { sessionId: id, markdown: body.note } });
    }
  }

  return NextResponse.json({ ok: true, session: updated, previous: existing });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.session.findFirst({ where: { id, patient: { ownerUserId: userId } }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.session.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
