import { redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { SessionCreateForm } from "@/components/sessions/SessionCreateForm";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { buildIsraelDateTime, detectPotentialMerge } from "@/lib/recurring-sessions";
import { prisma } from "@/lib/prisma";

const TZ = "Asia/Jerusalem";

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function toTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes() - (date.getMinutes() % 5)).padStart(2, "0")}`;
}

function getIsraelWeekday(date: Date): number {
  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return days[dayName] ?? 0;
}

function toDbFixedSessionDay(dateStr: string) {
  const base = new Date(`${dateStr}T00:00:00Z`);
  const jsDay = getIsraelWeekday(base); // 0=Sun..6=Sat in Israel tz
  return jsDay === 6 ? 0 : jsDay + 1;
}

function getFixedDateForWeek(dateStr: string, fixedSessionDay: number) {
  const base = new Date(`${dateStr}T00:00:00Z`);
  const currentDay = getIsraelWeekday(base); // 0=Sun..6=Sat (Israel tz)
  const targetDay = ((fixedSessionDay - 1) + 7) % 7;
  const diff = targetDay - currentDay;
  const fixedDate = new Date(base);
  fixedDate.setUTCDate(base.getUTCDate() + diff);
  return fixedDate.toISOString().slice(0, 10);
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
  const scheduleAction = String(formData.get("scheduleAction") ?? "").trim();

  if (!patientId || !date || !time) {
    redirect(`/sessions/new?patientId=${patientId}&error=missing`);
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, ownerUserId: userId, archivedAt: null },
    select: {
      id: true,
      defaultSessionFeeNis: true,
      fixedSessionDay: true,
      fixedSessionTime: true,
    },
  });
  if (!patient) redirect("/sessions/new?error=patient");

  const [hourRaw, minuteRaw] = time.split(":").map(Number);
  let scheduledAt = buildIsraelDateTime(date, Number(hourRaw), Number(minuteRaw));
  if (Number.isNaN(scheduledAt.getTime())) {
    redirect(`/sessions/new?patientId=${patientId}&error=datetime`);
  }

  const effectiveFee = Number.isFinite(feeNis) && feeNis > 0 ? feeNis : patient.defaultSessionFeeNis;

  const effectiveTime = scheduleAction === "use_fixed" && patient.fixedSessionTime ? patient.fixedSessionTime : time;

  if (scheduleAction === "use_fixed" && patient.fixedSessionDay && patient.fixedSessionTime) {
    const fixedDate = getFixedDateForWeek(date, patient.fixedSessionDay);
    const [fixedHour, fixedMinute] = patient.fixedSessionTime.split(":").map(Number);
    scheduledAt = buildIsraelDateTime(fixedDate, Number(fixedHour), Number(fixedMinute));
  }

  // Create the session
  const newSession = await prisma.session.create({
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

  if (scheduleAction === "move_fixed") {
    const nextFixedDay = toDbFixedSessionDay(date);
    // Delete future recurring template sessions so they get regenerated with the new day/time
    await prisma.session.deleteMany({
      where: {
        patientId,
        isRecurringTemplate: true,
        status: "SCHEDULED",
        scheduledAt: { gt: new Date() },
      },
    });
    await prisma.patient.update({
      where: { id: patientId },
      data: {
        fixedSessionDay: nextFixedDay,
        fixedSessionTime: time,
      },
    });
    redirect(`/sessions/${newSession.id}`);
  }

  // Check if this session should be merged with a recurring schedule
  if (!scheduleAction && patient.fixedSessionDay && patient.fixedSessionTime) {
    const existingSessions = await prisma.session.findMany({
      where: { patientId, status: { not: "CANCELED" } },
      select: { id: true, scheduledAt: true, status: true },
    });

    const mergeSuggestion = detectPotentialMerge(
      scheduledAt,
      parseInt(effectiveTime.split(":")[0], 10),
      parseInt(effectiveTime.split(":")[1], 10),
      {
        fixedSessionDay: patient.fixedSessionDay,
        fixedSessionTime: patient.fixedSessionTime,
      },
      existingSessions
    );

    if (mergeSuggestion.shouldMerge) {
      // Encode merge suggestion in URL
      const params = new URLSearchParams({
        sessionId: newSession.id,
        suggestMerge: "true",
      });
      redirect(`/sessions/${newSession.id}?${params.toString()}`);
    }
  }

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
    select: {
      id: true,
      firstName: true,
      lastName: true,
      defaultSessionFeeNis: true,
      fixedSessionDay: true,
      fixedSessionTime: true,
    },
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
          patients={patients.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            defaultSessionFeeNis: p.defaultSessionFeeNis,
            fixedSessionDay: p.fixedSessionDay,
            fixedSessionTime: p.fixedSessionTime,
          }))}
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
