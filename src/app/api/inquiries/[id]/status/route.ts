import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { InquiryStatus } from "@prisma/client";
import { requireCurrentUserId } from "@/lib/auth-server";
import { convertInquiryToPatientById, isInquiryStatus } from "@/lib/inquiries";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const nextStatus = body?.status;
  if (!isInquiryStatus(nextStatus)) {
    return NextResponse.json({ error: "סטטוס פנייה לא תקין." }, { status: 400 });
  }

  const existing = await prisma.inquiry.findFirst({
    where: { id, ownerUserId: userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "הפנייה לא נמצאה." }, { status: 404 });
  }

  if (nextStatus === InquiryStatus.CONVERTED) {
    const converted = await convertInquiryToPatientById({ inquiryId: id, userId });
    if (!converted) {
      return NextResponse.json({ error: "הפנייה לא נמצאה." }, { status: 404 });
    }

    revalidatePath("/inquiries");
    revalidatePath("/patients");

    return NextResponse.json({
      ok: true,
      status: converted.status,
      patientId: converted.patientId,
    });
  }

  const updated = await prisma.inquiry.update({
    where: { id },
    data: { status: nextStatus },
    select: { status: true, patientId: true },
  });

  revalidatePath("/inquiries");

  return NextResponse.json({
    ok: true,
    status: updated.status,
    patientId: updated.patientId,
  });
}
