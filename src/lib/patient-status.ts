import {
  PatientLifecycleEventType,
  Prisma,
  SessionStatus,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const INACTIVE_CANCELLATION_REASON = "המטופל הועבר למצב לא פעיל";

type Tx = Prisma.TransactionClient;

type LifecycleMetadata = Prisma.InputJsonObject | null;

export class PatientStatusError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "PATIENT_STATUS_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function parseRequiredDate(raw: unknown, fieldLabel: string) {
  const value = String(raw ?? "").trim();
  if (!value) {
    throw new PatientStatusError(`חובה להזין ${fieldLabel}.`, 400, "MISSING_DATE");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PatientStatusError(`${fieldLabel} לא תקין.`, 400, "INVALID_DATE");
  }
  return parsed;
}

export async function createPatientLifecycleEvent(
  tx: Tx,
  {
    patientId,
    actorUserId,
    eventType,
    occurredAt,
    reason,
    metadata,
  }: {
    patientId: string;
    actorUserId: string;
    eventType: PatientLifecycleEventType;
    occurredAt: Date;
    reason?: string | null;
    metadata?: LifecycleMetadata;
  },
) {
  return tx.patientLifecycleEvent.create({
    data: {
      patientId,
      actorUserId,
      eventType,
      occurredAt,
      reason: reason?.trim() ? reason.trim() : null,
      metadataJson: metadata ?? undefined,
    },
  });
}

export async function reactivatePatientInTx(
  tx: Tx,
  {
    patientId,
    actorUserId,
    reactivatedAt,
    reason,
    metadata,
  }: {
    patientId: string;
    actorUserId: string;
    reactivatedAt: Date;
    reason: string;
    metadata?: LifecycleMetadata;
  },
) {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new PatientStatusError("חובה להזין סיבת חזרה לטיפול.", 400, "MISSING_REASON");
  }

  const existing = await tx.patient.findFirst({
    where: { id: patientId, ownerUserId: actorUserId },
    select: { id: true, archivedAt: true },
  });
  if (!existing) {
    throw new PatientStatusError("המטופל לא נמצא.", 404, "PATIENT_NOT_FOUND");
  }

  await tx.patient.update({
    where: { id: patientId },
    data: { archivedAt: null },
  });

  await createPatientLifecycleEvent(tx, {
    patientId,
    actorUserId,
    eventType: PatientLifecycleEventType.REACTIVATED,
    occurredAt: reactivatedAt,
    reason: normalizedReason,
    metadata,
  });

  return {
    patientId,
    wasAlreadyActive: existing.archivedAt === null,
    status: "ACTIVE" as const,
  };
}

export async function reactivatePatientById({
  patientId,
  actorUserId,
  reactivatedAt,
  reason,
}: {
  patientId: string;
  actorUserId: string;
  reactivatedAt: Date;
  reason: string;
}) {
  return prisma.$transaction((tx) =>
    reactivatePatientInTx(tx, {
      patientId,
      actorUserId,
      reactivatedAt,
      reason,
      metadata: null,
    }),
  );
}

export async function setPatientInactiveById({
  patientId,
  actorUserId,
  inactiveAt,
  reason,
  cancelFutureSessions,
  closeOpenTasks,
}: {
  patientId: string;
  actorUserId: string;
  inactiveAt: Date;
  reason?: string | null;
  cancelFutureSessions?: boolean;
  closeOpenTasks?: boolean;
}) {
  const shouldCancelFutureSessions = Boolean(cancelFutureSessions);
  const shouldCloseOpenTasks = Boolean(closeOpenTasks);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.patient.findFirst({
      where: { id: patientId, ownerUserId: actorUserId },
      select: { id: true, archivedAt: true },
    });
    if (!existing) {
      throw new PatientStatusError("המטופל לא נמצא.", 404, "PATIENT_NOT_FOUND");
    }

    let canceledSessionsCount = 0;
    let closedTasksCount = 0;

    if (shouldCancelFutureSessions) {
      const canceledSessions = await tx.session.updateMany({
        where: {
          patientId,
          status: SessionStatus.SCHEDULED,
          scheduledAt: { gte: inactiveAt },
        },
        data: {
          status: SessionStatus.CANCELED,
          canceledAt: new Date(),
          cancellationReason: INACTIVE_CANCELLATION_REASON,
        },
      });
      canceledSessionsCount = canceledSessions.count;
    }

    if (shouldCloseOpenTasks) {
      const closedTasks = await tx.task.updateMany({
        where: {
          patientId,
          status: TaskStatus.OPEN,
        },
        data: {
          status: TaskStatus.CANCELED,
          completedAt: null,
        },
      });
      closedTasksCount = closedTasks.count;
    }

    await tx.patient.update({
      where: { id: patientId },
      data: {
        archivedAt: inactiveAt,
      },
    });

    await createPatientLifecycleEvent(tx, {
      patientId,
      actorUserId,
      eventType: PatientLifecycleEventType.SET_INACTIVE,
      occurredAt: inactiveAt,
      reason: reason ?? null,
      metadata: {
        cancelFutureSessions: shouldCancelFutureSessions,
        closeOpenTasks: shouldCloseOpenTasks,
        canceledSessionsCount,
        closedTasksCount,
      },
    });

    return {
      patientId,
      status: "INACTIVE" as const,
      wasAlreadyInactive: existing.archivedAt !== null,
      canceledSessionsCount,
      closedTasksCount,
    };
  });
}
