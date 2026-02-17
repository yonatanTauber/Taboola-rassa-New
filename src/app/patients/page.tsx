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
  const userId = await requireCurrentUserId();
  if (!userId) return null;

  const patients = await prisma.patient.findMany({
    where: { archivedAt: null, ownerUserId: userId },
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
  });

  const total = patients.length;
  const needsContact = patients.filter((p) => p.tasks.length > 0).length;
  const now = new Date();
  const activeThisWeek = patients.filter((p) =>
    p.sessions.some((s) => s.status === SessionStatus.SCHEDULED || s.status === SessionStatus.COMPLETED),
  ).length;

  return (
    <main className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
      <section className="space-y-4">
        {saved ? <Notice text="מטופל חדש נשמר בהצלחה." /> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard label="סה״כ מטופלים" value={String(total)} />
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
          }))}
        />
      </section>

      <section className="app-section">
        <h2 className="mb-3 text-lg font-semibold">פעולות</h2>
        <Link
          href="/patients/new"
          className="inline-flex w-full items-center justify-center rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium transition hover:bg-accent-soft"
        >
          פתיחת טופס מטופל חדש
        </Link>
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
