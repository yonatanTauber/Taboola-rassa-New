import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: patientId } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId, archivedAt: null },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as { names: string[] };
  const names = (body.names ?? []).map((n: string) => n.trim()).filter(Boolean);
  if (!names.length) return NextResponse.json({ ok: true, created: 0 });

  const created = await prisma.$transaction(
    names.map((name) =>
      prisma.patientFigure.create({
        data: { patientId, name, role: "OTHER" },
      })
    )
  );

  return NextResponse.json({ ok: true, created: created.length });
}
