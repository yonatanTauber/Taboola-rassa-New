import { InquiryStatus, Prisma } from "@prisma/client";
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
}: {
  inquiryId: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findFirst({
      where: { id: inquiryId, ownerUserId: userId },
    });
    if (!inquiry) return null;

    if (inquiry.patientId) {
      const updated = await tx.inquiry.update({
        where: { id: inquiryId },
        data: { status: InquiryStatus.CONVERTED },
        select: { id: true, status: true, patientId: true },
      });
      return updated;
    }

    const patient = await tx.patient.create({
      data: {
        ownerUserId: userId,
        internalCode: await generateInternalCode(tx),
        firstName: inquiry.firstName,
        lastName: inquiry.lastName,
        gender: inquiry.gender ?? "OTHER",
        phone: inquiry.phone,
        treatmentStartDate: new Date(),
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

    const updated = await tx.inquiry.update({
      where: { id: inquiryId },
      data: { patientId: patient.id, status: InquiryStatus.CONVERTED },
      select: { id: true, status: true, patientId: true },
    });

    return updated;
  });
}
