import { GuidanceWorkspace } from "@/components/guidance/GuidanceWorkspace";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";

export default async function GuidancePage() {
  const userId = await requireCurrentUserId();
  if (!userId) return null;

  const [guidances, patients, instructors] = await Promise.all([
    prisma.guidance.findMany({
      where: { patient: { ownerUserId: userId } },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        instructor: {
          select: { id: true, fullName: true },
        },
        sessions: { select: { sessionId: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 400,
    }),
    prisma.patient.findMany({
      where: { ownerUserId: userId, archivedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 400,
    }),
    prisma.instructor.findMany({
      where: { ownerUserId: userId },
      select: { id: true, fullName: true },
      orderBy: [{ fullName: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);

  return (
    <GuidanceWorkspace
      rows={guidances.map((item) => ({
        id: item.id,
        title: item.title,
        scheduledAt: item.scheduledAt ? item.scheduledAt.toISOString() : "",
        status: item.status,
        feeNis: item.feeNis,
        updatedAt: item.updatedAt.toISOString(),
        patient: {
          id: item.patient.id,
          name: formatPatientName(item.patient.firstName, item.patient.lastName),
        },
        instructor: item.instructor
          ? {
              id: item.instructor.id,
              fullName: item.instructor.fullName,
            }
          : null,
        sessionsCount: item.sessions.length,
      }))}
      patients={patients.map((patient) => ({
        id: patient.id,
        name: formatPatientName(patient.firstName, patient.lastName),
      }))}
      instructors={instructors.map((instructor) => ({
        id: instructor.id,
        fullName: instructor.fullName,
      }))}
    />
  );
}
