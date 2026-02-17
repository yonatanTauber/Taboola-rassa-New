import Link from "next/link";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

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
        <form action={createTask} className="space-y-3">
          <label className="space-y-1">
            <div className="text-xs text-muted">שיוך למטופל (אופציונלי)</div>
            <select name="patientId" defaultValue={selected?.id ?? ""} className="app-select">
              <option value="">משימה כללית לקליניקה</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {formatPatientName(patient.firstName, patient.lastName)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs text-muted">משימה</div>
            <input name="title" required className="app-field" placeholder="מה צריך לבצע?" />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-muted">תאריך לביצוע</div>
            <input name="dueAt" type="date" defaultValue={toDateInput(new Date())} className="app-field" />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input name="withReminder" type="checkbox" className="accent-accent" />
            תזכורת במערכת
          </label>

          <div className="flex justify-end gap-2">
            <Link href={selected ? `/patients/${selected.id}` : "/tasks"} className="app-btn app-btn-secondary">ביטול</Link>
            <button type="submit" className="app-btn app-btn-primary">אישור</button>
          </div>
        </form>
      </section>
    </main>
  );
}
