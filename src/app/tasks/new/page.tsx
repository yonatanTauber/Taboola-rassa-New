import { redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { NewTaskForm } from "@/components/tasks/NewTaskForm";

async function createTask(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) redirect("/login");

  const patientId = String(formData.get("patientId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const dueAt = String(formData.get("dueAt") ?? "").trim();
  const withReminder = String(formData.get("withReminder") ?? "") === "on";

  if (!title) {
    redirect(`/tasks/new?patientId=${patientId}&error=missing`);
  }

  if (patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ownerUserId: userId, archivedAt: null },
      select: { id: true },
    });
    if (!patient) redirect("/tasks/new?error=patient");
  }

  await prisma.task.create({
    data: {
      ownerUserId: userId,
      patientId: patientId || null,
      title,
      dueAt: dueAt ? new Date(dueAt) : null,
      reminderAt: withReminder && dueAt ? new Date(`${dueAt}T09:00:00`) : null,
      status: "OPEN",
    },
  });

  if (patientId) {
    redirect(`/patients/${patientId}`);
  }
  redirect("/tasks");
}

function errorText(code?: string) {
  if (code === "missing") return "יש להזין טקסט למשימה.";
  if (code === "patient") return "לא נמצא מטופל מתאים.";
  return null;
}

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;

  const params = (await searchParams) ?? {};
  const patientIdParam = typeof params.patientId === "string" ? params.patientId : "";
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const error = errorText(errorCode);

  const patients = await prisma.patient.findMany({
    where: { ownerUserId: userId, archivedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 400,
  });
  const selected = patients.find((p) => p.id === patientIdParam) ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4">
      <BackButton fallback={selected ? `/patients/${selected.id}` : "/tasks"} />
      <section className="app-section border-black/18">
        <h1 className="mb-3 text-xl font-semibold">הוספת משימה</h1>
        {error ? <div className="mb-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
        <NewTaskForm
          patients={patients}
          initialPatientId={selected?.id ?? ""}
          selectedId={selected?.id ?? null}
          action={createTask}
        />
      </section>
    </main>
  );
}
