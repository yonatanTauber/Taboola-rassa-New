import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { EntityLink } from "@/components/EntityLink";
import { TaskEditor } from "@/components/TaskEditor";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";

export default async function TaskDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const [task, patients] = await Promise.all([
    prisma.task.findFirst({
      where: {
        id,
        OR: [
          { ownerUserId: userId },
          { patient: { ownerUserId: userId } },
          { session: { patient: { ownerUserId: userId } } },
        ],
      },
      include: {
        patient: true,
        session: true,
      },
    }),
    prisma.patient.findMany({
      where: { ownerUserId: userId, archivedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  if (!task) return notFound();

  return (
    <main className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl space-y-3">
        <BackButton fallback="/sessions" />

        <TaskEditor
          task={{
            id: task.id,
            title: task.title,
            status: task.status,
            dueAt: task.dueAt ? toDateInput(task.dueAt) : "",
            patientId: task.patientId ?? "",
          }}
          patients={patients.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
        />

        <section className="rounded-2xl border border-black/10 bg-white p-4 text-sm space-y-2">
          {task.patient ? (
            <EntityLink
              type="patient"
              id={task.patient.id}
              label={formatPatientName(task.patient.firstName, task.patient.lastName)}
            />
          ) : null}
          {task.session ? (
            <EntityLink
              type="session"
              id={task.session.id}
              label={`פגישה · ${task.session.scheduledAt.toLocaleDateString("he-IL")}`}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
