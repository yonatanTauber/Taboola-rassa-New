import {
  InquiryStatus,
  PatientLifecycleEventType,
  Prisma,
} from "@prisma/client";
import {
  createPatientLifecycleEvent,
  PatientStatusError,
  reactivatePatientInTx,
} from "@/lib/patient-status";
import { prisma } from "@/lib/prisma";

export const INQUIRY_STATUS_VALUES: InquiryStatus[] = [
  InquiryStatus.NEW,
  InquiryStatus.DISCOVERY_CALL,
  InquiryStatus.WAITLIST,
  InquiryStatus.CONVERTED,
  InquiryStatus.CLOSED,
];

export function isInquiryStatus(value: unknown): value is InquiryStatus {
  return typeof value === "string" && INQUIRY_STATUS_VALUES.includes(value as InquiryStatus);
}

async function generateInternalCode(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");
    const candidate = `PT-${year}-${suffix}`;
    const exists = await tx.patient.findUnique({
      where: { internalCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `PT-${year}-${Date.now()}`;
}

export async function convertInquiryToPatientById({
  inquiryId,
  userId,
  reactivatedAt,
  reactivationReason,
}: {
  inquiryId: string;
  userId: string;
  reactivatedAt?: Date;
  reactivationReason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findFirst({
      where: { id: inquiryId, ownerUserId: userId },
      select: {
        id: true,
        status: true,
        patientId: true,
        firstName: true,
        lastName: true,
        phone: true,
        gender: true,
        referralSource: true,
        referralDetails: true,
        notes: true,
      },
    });
    if (!inquiry) return null;

    const now = new Date();

    if (inquiry.patientId) {
      const linkedPatient = await tx.patient.findFirst({
        where: { id: inquiry.patientId, ownerUserId: userId },
        select: { id: true, archivedAt: true },
      });
      if (!linkedPatient) {
        throw new PatientStatusError("המטופל המקושר לפנייה לא נמצא.", 404, "LINKED_PATIENT_NOT_FOUND");
      }

      let patientWasReactivated = false;
      if (linkedPatient.archivedAt) {
        if (!reactivatedAt || !reactivationReason?.trim()) {
          throw new PatientStatusError(
            "המטופל המקושר אינו פעיל. יש להזין תאריך וסיבת חזרה לטיפול.",
            409,
            "REACTIVATION_REQUIRED",
          );
        }
        await reactivatePatientInTx(tx, {
          patientId: linkedPatient.id,
          actorUserId: userId,
          reactivatedAt,
          reason: reactivationReason,
          metadata: { source: "inquiry-conversion", inquiryId },
        });
        patientWasReactivated = true;
      }

      const updated =
        inquiry.status === InquiryStatus.CONVERTED
          ? {
              id: inquiry.id,
              status: InquiryStatus.CONVERTED,
              patientId: linkedPatient.id,
            }
          : await tx.inquiry.update({
              where: { id: inquiryId },
              data: { status: InquiryStatus.CONVERTED },
              select: { id: true, status: true, patientId: true },
            });

      if (inquiry.status !== InquiryStatus.CONVERTED) {
        await createPatientLifecycleEvent(tx, {
          patientId: linkedPatient.id,
          actorUserId: userId,
          eventType: PatientLifecycleEventType.INQUIRY_LINKED,
          occurredAt: now,
          reason: "הפנייה סומנה כהמרה למטופל קיים.",
          metadata: { inquiryId },
        });
      }

      return { ...updated, patientWasReactivated };
    }

    const patient = await tx.patient.create({
      data: {
        ownerUserId: userId,
        internalCode: await generateInternalCode(tx),
        firstName: inquiry.firstName,
        lastName: inquiry.lastName,
        gender: inquiry.gender ?? "OTHER",
        phone: inquiry.phone,
        treatmentStartDate: now,
        researchAlias: `P-${Math.floor(Math.random() * 1_000_000)
          .toString()
          .padStart(6, "0")}`,
        intakes:
          inquiry.referralSource || inquiry.referralDetails || inquiry.notes
            ? {
                create: {
                  referralReason: inquiry.referralSource || null,
                  freeText: [inquiry.referralDetails, inquiry.notes].filter(Boolean).join("\n\n") || null,
                },
              }
            : undefined,
      },
      select: { id: true },
    });

    await createPatientLifecycleEvent(tx, {
      patientId: patient.id,
      actorUserId: userId,
      eventType: PatientLifecycleEventType.CONVERTED_TO_PATIENT,
      occurredAt: now,
      reason: "התיק נוצר מפנייה.",
      metadata: { inquiryId },
    });

    await createPatientLifecycleEvent(tx, {
      patientId: patient.id,
      actorUserId: userId,
      eventType: PatientLifecycleEventType.INQUIRY_LINKED,
      occurredAt: now,
      reason: "פנייה קושרה למטופל חדש.",
      metadata: { inquiryId },
    });

    const updated = await tx.inquiry.update({
      where: { id: inquiryId },
      data: { patientId: patient.id, status: InquiryStatus.CONVERTED },
      select: { id: true, status: true, patientId: true },
    });

    return { ...updated, patientWasReactivated: false };
  });
}
