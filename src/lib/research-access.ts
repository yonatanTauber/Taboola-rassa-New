import { ResearchTargetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listOwnedPatientIds(userId: string) {
  const patients = await prisma.patient.findMany({
    where: { ownerUserId: userId, archivedAt: null },
    select: { id: true },
    take: 5000,
  });
  return patients.map((patient) => patient.id);
}

export async function isResearchDocumentOwnedByUser(userId: string, documentId: string) {
  const ownedPatientIds = await listOwnedPatientIds(userId);
  if (ownedPatientIds.length === 0) return false;

  const doc = await prisma.researchDocument.findFirst({
    where: {
      id: documentId,
      links: {
        some: {
          targetEntityType: ResearchTargetType.PATIENT,
          targetEntityId: { in: ownedPatientIds },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(doc);
}

export async function isResearchTargetOwnedByUser(
  userId: string,
  targetType: ResearchTargetType,
  targetId: string,
) {
  if (!targetId) return false;

  if (targetType === ResearchTargetType.PATIENT) {
    const patient = await prisma.patient.findFirst({
      where: { id: targetId, ownerUserId: userId, archivedAt: null },
      select: { id: true },
    });
    return Boolean(patient);
  }

  if (targetType === ResearchTargetType.SESSION) {
    const session = await prisma.session.findFirst({
      where: { id: targetId, patient: { ownerUserId: userId } },
      select: { id: true },
    });
    return Boolean(session);
  }

  if (targetType === ResearchTargetType.TASK) {
    const task = await prisma.task.findFirst({
      where: {
        id: targetId,
        OR: [
          { ownerUserId: userId },
          { patient: { ownerUserId: userId } },
          { session: { patient: { ownerUserId: userId } } },
        ],
      },
      select: { id: true },
    });
    return Boolean(task);
  }

  if (targetType === ResearchTargetType.RECEIPT) {
    const receipt = await prisma.receipt.findFirst({
      where: { id: targetId, patient: { ownerUserId: userId } },
      select: { id: true },
    });
    return Boolean(receipt);
  }

  if (targetType === ResearchTargetType.INQUIRY) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: targetId, ownerUserId: userId },
      select: { id: true },
    });
    return Boolean(inquiry);
  }

  if (targetType === ResearchTargetType.RESEARCH_DOCUMENT) {
    return isResearchDocumentOwnedByUser(userId, targetId);
  }

  return false;
}

export async function resolveResearchNoteOwnership(userId: string, noteId: string) {
  const note = await prisma.researchNote.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      links: {
        select: {
          targetEntityType: true,
          targetEntityId: true,
        },
      },
    },
  });
  if (!note) return { exists: false, owned: false };
  if (note.links.length === 0) return { exists: true, owned: false };

  const uniqueTargets = new Map<string, { type: ResearchTargetType; id: string }>();
  for (const link of note.links) {
    const key = `${link.targetEntityType}:${link.targetEntityId}`;
    if (!uniqueTargets.has(key)) {
      uniqueTargets.set(key, {
        type: link.targetEntityType,
        id: link.targetEntityId,
      });
    }
  }

  const checks = await Promise.all(
    [...uniqueTargets.values()].map((target) =>
      isResearchTargetOwnedByUser(userId, target.type, target.id),
    ),
  );

  return { exists: true, owned: checks.some(Boolean) };
}

export function normalizeResearchTargetType(value: string | null) {
  if (!value) return ResearchTargetType.OTHER;
  if (value === "PATIENT") return ResearchTargetType.PATIENT;
  if (value === "SESSION") return ResearchTargetType.SESSION;
  if (value === "TASK") return ResearchTargetType.TASK;
  if (value === "RECEIPT") return ResearchTargetType.RECEIPT;
  if (value === "INQUIRY") return ResearchTargetType.INQUIRY;
  if (value === "RESEARCH_DOCUMENT") return ResearchTargetType.RESEARCH_DOCUMENT;
  return ResearchTargetType.OTHER;
}
