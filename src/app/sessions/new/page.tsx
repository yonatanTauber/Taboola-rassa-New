import { redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { SessionCreateForm } from "@/components/sessions/SessionCreateForm";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function toTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes() - (date.getMinutes() % 5)).padStart(2, "0")}`;
}

async function createSession(formData: FormData) {
  "use server";
  const userId = await requireCurrentUserId();
  if (!userId) redirect("/login");

  const patientId = String(formData.get("patientId") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const location = String(formData.get("location") ?? "קליניקה").trim();
  const feeNis = Number(formData.get("feeNis") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!patientId || !date || !time) {
    redirect(`/sessions/new?patientId=${patientId}&error=missing`);
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId, archivedAt: null },
    select: { id: true, defaultSessionFeeNis: true },
  });
  if (!patient) redirect("/sessions/new?error=patient");

  const scheduledAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(scheduledAt.getTime())) {
    redirect(`/sessions/new?patientId=${patientId}&error=datetime`);
  }

  const effectiveFee = Number.isFinite(feeNis) && feeNis > 0 ? feeNis : patient.defaultSessionFeeNis;

  await prisma.session.create({
    data: {
      patientId,
      scheduledAt,
      status: note.length > 0 && scheduledAt.getTime() <= Date.now() ? "COMPLETED" : "SCHEDULED",
      location: location || null,
      feeNis: effectiveFee ?? null,
      sessionNote: note
        ? {
            create: {
              markdown: note,
            },
          }
        : undefined,
    },
  });

  redirect(`/patients/${patientId}`);
}

function errorText(code?: string) {
  if (code === "missing") return "יש להשלים מטופל, תאריך ושעה.";
  if (code === "datetime") return "תאריך או שעה לא תקינים.";
  if (code === "patient") return "לא נמצא מטופל מתאים.";
  return null;
}

export default async function NewSessionPage({
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
    select: { id: true, firstName: true, lastName: true, defaultSessionFeeNis: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 400,
  });

  const selected = patients.find((p) => p.id === patientIdParam) ?? patients[0] ?? null;
  const now = new Date();
  const futureSessions = await prisma.session.findMany({
    where: {
      patient: { ownerUserId: userId, archivedAt: null },
      scheduledAt: { gte: now },
      status: { in: ["SCHEDULED", "UNDOCUMENTED"] },
    },
    select: { id: true, patientId: true, scheduledAt: true },
    orderBy: { scheduledAt: "asc" },
    take: 300,
  });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4">
      <BackButton fallback={selected ? `/patients/${selected.id}` : "/sessions"} />
      <section className="app-section border-black/18">
        <h1 className="mb-3 text-xl font-semibold">הוספת פגישה</h1>
        {selected ? (
          <div className="mb-3 rounded-lg border border-black/12 bg-white/80 px-3 py-2 text-sm text-ink">
            מטופל נבחר: <span className="font-semibold">{formatPatientName(selected.firstName, selected.lastName)}</span>
          </div>
        ) : null}
        <SessionCreateForm
          patients={patients}
          initialPatientId={selected?.id ?? ""}
          initialDate={toDateInput(now)}
          initialTime={toTimeInput(now)}
          error={error}
          futureSessions={futureSessions.map((item) => ({
            id: item.id,
            patientId: item.patientId,
            scheduledAtIso: item.scheduledAt.toISOString(),
          }))}
          action={createSession}
        />
      </section>
    </main>
  );
}
