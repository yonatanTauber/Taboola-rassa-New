import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { InquiryStatus } from "@prisma/client";
import { requireCurrentUserId } from "@/lib/auth-server";
import { convertInquiryToPatientById, isInquiryStatus } from "@/lib/inquiries";
import { PatientStatusError } from "@/lib/patient-status";
import { prisma } from "@/lib/prisma";

function parseOptionalDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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
    select: { id: true, status: true, patientId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "הפנייה לא נמצאה." }, { status: 404 });
  }

  if (existing.status === InquiryStatus.CONVERTED && nextStatus !== InquiryStatus.CONVERTED) {
    return NextResponse.json(
      {
        error: "לא ניתן לשנות סטטוס של פנייה שהומרה למטופל.",
        code: "INQUIRY_STATUS_LOCKED",
        patientId: existing.patientId,
      },
      { status: 409 },
    );
  }

  if (nextStatus === InquiryStatus.CONVERTED) {
    try {
      const converted = await convertInquiryToPatientById({
        inquiryId: id,
        userId,
        reactivatedAt: parseOptionalDate(body?.reactivatedAt) ?? undefined,
        reactivationReason:
          typeof body?.reactivationReason === "string" ? body.reactivationReason.trim() : undefined,
      });
      if (!converted) {
        return NextResponse.json({ error: "הפנייה לא נמצאה." }, { status: 404 });
      }

      const linkedPatient = converted.patientId
        ? await prisma.patient.findFirst({
            where: { id: converted.patientId, ownerUserId: userId },
            select: { archivedAt: true },
          })
        : null;

      revalidatePath("/inquiries");
      revalidatePath("/patients");
      if (converted.patientId) {
        revalidatePath(`/patients/${converted.patientId}`);
      }

      return NextResponse.json({
        ok: true,
        status: converted.status,
        patientId: converted.patientId,
        patientInactive: linkedPatient ? Boolean(linkedPatient.archivedAt) : null,
        patientWasReactivated: converted.patientWasReactivated,
      });
    } catch (error) {
      if (error instanceof PatientStatusError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            patientId: existing.patientId,
          },
          { status: error.status },
        );
      }
      return NextResponse.json({ error: "שמירת סטטוס הפנייה נכשלה." }, { status: 500 });
    }
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
