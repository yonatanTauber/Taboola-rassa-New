import { SessionStatus } from "@prisma/client";
import Link from "next/link";
import { PatientsTable } from "@/components/PatientsTable";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const saved = typeof params.saved === "string" ? params.saved : "";
  const viewParam = typeof params.view === "string" ? params.view : "active";
  const layoutParam = typeof params.layout === "string" ? params.layout : "table";
  const inactiveMode = viewParam === "inactive" || viewParam === "archived";
  const displayMode = layoutParam === "cards" ? "cards" : "table";

  const userId = await requireCurrentUserId();
  if (!userId) return null;

  const [activeCount, inactiveCount, patients] = await Promise.all([
    prisma.patient.count({ where: { archivedAt: null, ownerUserId: userId } }),
    prisma.patient.count({ where: { archivedAt: { not: null }, ownerUserId: userId } }),
    prisma.patient.findMany({
      where: inactiveMode
        ? { archivedAt: { not: null }, ownerUserId: userId }
        : { archivedAt: null, ownerUserId: userId },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        sessions: {
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            feeNis: true,
          },
        },
        tasks: {
          where: { status: "OPEN" },
        },
      },
    }),
  ]);

  const total = patients.length;
  const needsContact = patients.filter((p) => p.tasks.length > 0).length;
  const now = new Date();
  const activeThisWeek = patients.filter((p) =>
    p.sessions.some((s) => s.status === SessionStatus.SCHEDULED || s.status === SessionStatus.COMPLETED),
  ).length;

  return (
    <main className="space-y-4">
      <section className="app-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">מטופלים</h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-black/10 p-1 text-xs">
              <Link
                href={`/patients${inactiveMode ? "?view=inactive" : ""}`}
                className={`rounded-md px-2 py-1 ${displayMode === "table" ? "bg-accent-soft text-accent" : "text-muted"}`}
              >
                טבלה
              </Link>
              <Link
                href={`/patients?${inactiveMode ? "view=inactive&" : ""}layout=cards`}
                className={`rounded-md px-2 py-1 ${displayMode === "cards" ? "bg-accent-soft text-accent" : "text-muted"}`}
              >
                בלוקים
              </Link>
            </div>
            <Link href="/patients/archived" className="app-btn app-btn-secondary !px-3 !py-1.5 text-sm">
              ארכיון
            </Link>
            <Link
              href="/patients/new"
              className="app-btn app-btn-primary !px-3 !py-1.5 text-sm"
            >
              מטופל חדש
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={displayMode === "cards" ? "/patients?layout=cards" : "/patients"}
            className={`app-btn ${!inactiveMode ? "app-btn-primary" : "app-btn-secondary"} !text-sm`}
          >
            פעילים ({activeCount})
          </Link>
          <Link
            href={`/patients?view=inactive${displayMode === "cards" ? "&layout=cards" : ""}`}
            className={`app-btn ${inactiveMode ? "app-btn-primary" : "app-btn-secondary"} !text-sm`}
          >
            לא פעילים ({inactiveCount})
          </Link>
        </div>

        {!inactiveMode && saved ? <Notice text="מטופל חדש נשמר בהצלחה." /> : null}
        {inactiveMode ? <Notice text="תצוגת מטופלים לא פעילים פעילה." /> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard label={inactiveMode ? "סה״כ לא פעילים" : "סה״כ מטופלים"} value={String(total)} />
          <StatCard label="מטופלים למעקב" value={String(needsContact)} />
          <StatCard label="מטופלים פעילים" value={String(activeThisWeek)} />
        </div>

        <PatientsTable
          rows={patients.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            phone: p.phone,
            email: p.email ?? "",
            gender: p.gender,
            sessionsCount: p.sessions.length,
            age: p.dateOfBirth ? calcAge(p.dateOfBirth, now) : null,
            ageGroup: p.dateOfBirth ? ageGroupOf(calcAge(p.dateOfBirth, now)) : "UNKNOWN",
            defaultSessionFeeNis: p.defaultSessionFeeNis ?? null,
            lastSessionAt: resolveLastSessionAt(p.sessions, now),
            nextSessionAt: resolveNextSessionAt(p.sessions, now),
            openTasksCount: p.tasks.length,
            archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
          }))}
          archivedMode={inactiveMode}
          displayMode={displayMode}
        />
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return <div className="rounded-xl border border-accent/25 bg-accent-soft px-3 py-2 text-sm text-accent">{text}</div>;
}

function calcAge(dob: Date, now: Date) {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return Math.max(age, 0);
}

function ageGroupOf(age: number): "CHILD" | "YOUTH" | "ADULT" | "SENIOR" {
  if (age < 13) return "CHILD";
  if (age < 18) return "YOUTH";
  if (age < 75) return "ADULT";
  return "SENIOR";
}

function resolveLastSessionAt(
  sessions: Array<{ scheduledAt: Date; status: SessionStatus }>,
  now: Date,
) {
  const past = sessions
    .filter((s) => s.scheduledAt.getTime() <= now.getTime() && s.status !== SessionStatus.CANCELED)
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())[0];
  return past ? past.scheduledAt.toISOString() : null;
}

function resolveNextSessionAt(
  sessions: Array<{ scheduledAt: Date; status: SessionStatus }>,
  now: Date,
) {
  const upcoming = sessions
    .filter((s) => s.scheduledAt.getTime() > now.getTime() && s.status !== SessionStatus.CANCELED)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];
  return upcoming ? upcoming.scheduledAt.toISOString() : null;
}
