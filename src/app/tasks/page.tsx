import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";
import { TasksWorkspace } from "@/components/tasks/TasksWorkspace";

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const params = (await searchParams) ?? {};
  const initialPatientId = typeof params.patientId === "string" ? params.patientId : "ALL";
  const initialScopeRaw = typeof params.scope === "string" ? params.scope.toUpperCase() : "ALL";
  const initialScope =
    initialScopeRaw === "OPEN" ||
    initialScopeRaw === "DONE" ||
    initialScopeRaw === "CANCELED" ||
    initialScopeRaw === "THIS_WEEK"
      ? initialScopeRaw
      : "ALL";
  const [tasks, patients] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          { patient: { ownerUserId: userId } },
          { session: { patient: { ownerUserId: userId } } },
        ],
      },
      include: { patient: true, session: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 700,
    }),
    prisma.patient.findMany({
      where: { ownerUserId: userId, archivedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500,
    }),
  ]);

  return (
    <TasksWorkspace
      nowIso={new Date().toISOString()}
      initialPatientFilter={initialPatientId}
      initialScopeFilter={initialScope}
      tasks={tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueAt: task.dueAt?.toISOString(),
        patientId: task.patientId ?? undefined,
        patientName: task.patient ? formatPatientName(task.patient.firstName, task.patient.lastName) : undefined,
        patientInactive: task.patient ? Boolean(task.patient.archivedAt) : false,
        sessionId: task.sessionId ?? undefined,
      }))}
      patients={patients.map((p) => ({ id: p.id, name: formatPatientName(p.firstName, p.lastName) }))}
    />
  );
}
