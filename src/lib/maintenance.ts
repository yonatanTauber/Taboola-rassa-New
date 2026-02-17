import { SessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function markUndocumentedSessions(userId: string) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 1);
  cutoff.setHours(0, 0, 0, 0);

  await prisma.session.updateMany({
    where: {
      patient: { ownerUserId: userId },
      status: SessionStatus.SCHEDULED,
      scheduledAt: { lt: cutoff },
      sessionNote: null,
    },
    data: { status: SessionStatus.UNDOCUMENTED },
  });
}
