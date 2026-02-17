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

  const existing = await prisma.patient.findFirst({ where: { id, ownerUserId: userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.patient.update({
    where: { id },
    data: {
      firstName: typeof body.firstName === "string" ? body.firstName.trim() : undefined,
      lastName: typeof body.lastName === "string" ? body.lastName.trim() : undefined,
      phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
      email: body.email === "" ? null : typeof body.email === "string" ? body.email.trim() : undefined,
      gender:
        body.gender === "MALE" || body.gender === "FEMALE" || body.gender === "OTHER"
          ? body.gender
          : undefined,
      dateOfBirth:
        body.dateOfBirth === ""
          ? null
          : typeof body.dateOfBirth === "string"
            ? new Date(body.dateOfBirth)
            : undefined,
      fixedSessionDay:
        body.fixedSessionDay === "" ? null : typeof body.fixedSessionDay === "number" ? body.fixedSessionDay : undefined,
      fixedSessionTime:
        body.fixedSessionTime === ""
          ? null
          : typeof body.fixedSessionTime === "string"
            ? body.fixedSessionTime
            : undefined,
      defaultSessionFeeNis:
        body.defaultSessionFeeNis === ""
          ? null
          : typeof body.defaultSessionFeeNis === "number"
            ? body.defaultSessionFeeNis
            : undefined,
      avatarKey:
        body.avatarKey === ""
          ? null
          : typeof body.avatarKey === "string"
            ? body.avatarKey
            : undefined,
    },
  });

  return NextResponse.json({ ok: true, patient: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.patient.findFirst({ where: { id, ownerUserId: userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.patient.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({ ok: true, archived: true });
}
