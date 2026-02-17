import { SessionStatus, TaskStatus } from "@prisma/client";
import Link from "next/link";
import { CalendarSwitcher } from "@/components/CalendarSwitcher";
import { PatientQuickJump } from "@/components/PatientQuickJump";
import { QuickActionButton } from "@/components/QuickActionButton";
import { TaskChecklist } from "@/components/TaskChecklist";
import { markUndocumentedSessions } from "@/lib/maintenance";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth-server";

export default async function Home() {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  await markUndocumentedSessions(userId);

  const { dayStart, dayEnd } = getDayRange();

  const [patientCount, openTasksCount, todaySessions, lateCanceledCount, patients] = await Promise.all([
    prisma.patient.count({ where: { ownerUserId: userId, archivedAt: null } }),
    prisma.task.count({
      where: {
        status: TaskStatus.OPEN,
        OR: [
          { ownerUserId: userId },
          { patient: { ownerUserId: userId } },
          { session: { patient: { ownerUserId: userId } } },
        ],
      },
    }),
    prisma.session.findMany({
      where: { scheduledAt: { gte: dayStart, lte: dayEnd }, patient: { ownerUserId: userId } },
      orderBy: { scheduledAt: "asc" },
      include: { patient: true, paymentAllocations: true },
      take: 5,
    }),
    prisma.session.count({ where: { status: SessionStatus.CANCELED_LATE, patient: { ownerUserId: userId } } }),
    prisma.patient.findMany({
      where: { ownerUserId: userId, archivedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 100,
    }),
  ]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

  const [todayTasks, calendarSessions, calendarGuidances, calendarTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: TaskStatus.OPEN,
        dueAt: { gte: dayStart, lte: dayEnd },
        OR: [
          { ownerUserId: userId },
          { patient: { ownerUserId: userId } },
          { session: { patient: { ownerUserId: userId } } },
        ],
      },
      include: { patient: true, session: true },
      orderBy: { dueAt: "asc" },
      take: 4,
    }),
    prisma.session.findMany({
      where: {
        patient: { ownerUserId: userId },
        scheduledAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: { patient: true },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    }),
    prisma.guidance.findMany({
      where: {
        patient: { ownerUserId: userId },
        scheduledAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        patient: true,
        instructor: {
          select: { fullName: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    }),
    prisma.task.findMany({
      where: {
        status: TaskStatus.OPEN,
        dueAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        OR: [
          { ownerUserId: userId },
          { patient: { ownerUserId: userId } },
          { session: { patient: { ownerUserId: userId } } },
        ],
      },
      include: { patient: true, session: true },
      orderBy: { dueAt: "asc" },
      take: 200,
    }),
  ]);


  const insights = [
    { text: `יש כרגע ${openTasksCount} משימות פתוחות במערכת.`, href: "/tasks", cta: "פתח משימות" },
    { text: `עד כה סומנו ${lateCanceledCount} ביטולים מאוחרים.`, href: "/sessions", cta: "בדוק ביטולים" },
    { text: `מספר המטופלים הפעילים במערכת: ${patientCount}.`, href: "/patients", cta: "עבור למטופלים" },
  ];

  const insight = insights[new Date().getDate() % insights.length];

  const calendarViewModel = [
    ...calendarSessions.map((session) => ({
      id: `session:${session.id}`,
      patientId: session.patient.id,
      patient: formatPatientName(session.patient.firstName, session.patient.lastName),
      startIso: session.scheduledAt.toISOString(),
      statusLabel: statusLabel(session.status),
      href: `/sessions/${session.id}`,
      kind: "session" as const,
      title: "פגישה",
    })),
    ...calendarGuidances
      .filter((guidance) => guidance.scheduledAt)
      .map((guidance) => ({
        id: `guidance:${guidance.id}`,
        patientId: guidance.patient.id,
        patient: formatPatientName(guidance.patient.firstName, guidance.patient.lastName),
        startIso: (guidance.scheduledAt as Date).toISOString(),
        statusLabel: guidance.status === "COMPLETED" ? "הושלמה" : "פעילה",
        href: `/guidance/${guidance.id}`,
        kind: "guidance" as const,
        title: `הדרכה${guidance.instructor?.fullName ? ` · ${guidance.instructor.fullName}` : ""}`,
      })),
  ].sort((a, b) => +new Date(a.startIso) - +new Date(b.startIso));

  const calendarTasksModel = calendarTasks
    .filter((t): t is typeof t & { dueAt: Date } => Boolean(t.dueAt))
    .map((task) => ({
      id: task.id,
      title: task.title,
      dueIso: task.dueAt.toISOString(),
      patient: task.patient ? formatPatientName(task.patient.firstName, task.patient.lastName) : undefined,
      sessionId: task.sessionId ?? undefined,
    }));

  const greeting = getGreeting();

  return (
    <main className="flex flex-col gap-3">
      <section className="app-section flex flex-col gap-2">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="order-1 space-y-3 lg:order-1">
            <p className="text-sm text-muted">{new Date().toLocaleDateString("he-IL")} · מרכז קליניקה</p>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{greeting}, יונתן</h1>
            <p className="text-sm text-muted">תצפית יומית על פגישות, משימות, הכנסות ותיעוד.</p>
            <div className="pt-2">
              <div className="text-sm text-muted">מעבר מהיר למטופל</div>
              <div className="mt-2 max-w-[280px]">
                <PatientQuickJump patients={patients.map((p) => ({ id: p.id, name: formatPatientName(p.firstName, p.lastName) }))} />
              </div>
            </div>
          </div>
          <div className="order-2 space-y-3 lg:order-2">
            <div className="flex flex-wrap items-start gap-2">
              <MiniStat label="מטופלים פעילים" value={patientCount} href="/patients" hoverLabel="מעבר לרשימת מטופלים" />
              <MiniStat label="משימות פתוחות" value={openTasksCount} href="/tasks" hoverLabel="מעבר למשימות פתוחות" />
              <MiniStat label="ביטולים מאוחרים" value={lateCanceledCount} href="/sessions" hoverLabel="מעבר לביטולים מאוחרים" />
            </div>
            <Link href={insight.href} className="rounded-2xl border border-accent/20 bg-gradient-to-l from-accent-soft to-white px-4 py-3 text-sm text-accent transition hover:translate-y-[-1px]">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <span className="inline-block size-2 rounded-full bg-accent" />
                תובנה יומית
              </div>
              <div>{insight.text}</div>
              <div className="mt-1 text-xs opacity-80">{insight.cta}</div>
            </Link>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <section className="app-section">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">פגישות היום</h2>
              <QuickActionButton
                action="session"
                label="פגישה"
                className="app-btn app-btn-secondary text-xs"
              />
            </div>
            {todaySessions.length > 0 ? (
              <ul className="space-y-2">
                {todaySessions.map((session) => (
                  <li key={session.id}>
                    <Link href={`/sessions/${session.id}`} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 rounded-xl border border-black/8 bg-white px-3 py-2 hover:bg-black/[0.02]">
                      <div className="font-mono tabular-nums text-sm text-muted">{session.scheduledAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{formatPatientName(session.patient.firstName, session.patient.lastName)}</div>
                        <div className={`text-xs ${billingTone(session.feeNis ?? 0, session.paymentAllocations.reduce((sum, p) => sum + p.amountNis, 0))}`}>
                          {billingLabel(session.feeNis ?? 0, session.paymentAllocations.reduce((sum, p) => sum + p.amountNis, 0))}
                        </div>
                      </div>
                      <StatusBadge status={session.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">אין פגישות מתוכננות להיום.</p>}
          </section>

          <section className="app-section">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">משימות להיום</h2>
              <QuickActionButton
                action="task"
                label="משימה"
                className="app-btn app-btn-secondary text-xs"
              />
            </div>
            {todayTasks.length > 0 ? (
              <TaskChecklist
                tasks={todayTasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  patientName: task.patient?.firstName,
                  dueLabel: task.dueAt?.toLocaleDateString("he-IL"),
                  href: task.sessionId ? `/sessions/${task.sessionId}` : `/tasks/${task.id}`,
                }))}
              />
            ) : <p className="text-sm text-muted">אין משימות פתוחות להיום.</p>}
          </section>
        </div>

        <div className="grid gap-3">
          <CalendarSwitcher sessions={calendarViewModel} tasks={calendarTasksModel} />
        </div>
      </section>
    </main>
  );
}

function MiniStat({ label, value, href, hoverLabel }: { label: string; value: number; href: string; hoverLabel: string }) {
  return (
    <Link href={href} title={hoverLabel} className="inline-flex flex-col gap-0.5 rounded-lg border border-black/10 bg-white/92 px-2 py-1 transition hover:bg-white">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="text-lg font-semibold tracking-tight text-ink tabular-nums">{value}</div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = statusLabel(status);
  if (status === SessionStatus.CANCELED_LATE) return <span className="rounded-full bg-warn/15 px-3 py-1 text-xs text-warn">{label}</span>;
  if (status === SessionStatus.UNDOCUMENTED) return <span className="rounded-full bg-danger/15 px-3 py-1 text-xs text-danger">{label}</span>;
  return <span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">{label}</span>;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  return "ערב טוב";
}

function getDayRange() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
}

function statusLabel(status: string) {
  switch (status) {
    case SessionStatus.SCHEDULED:
      return "נקבעה";
    case SessionStatus.COMPLETED:
      return "התקיימה";
    case SessionStatus.CANCELED:
      return "בוטלה";
    case SessionStatus.CANCELED_LATE:
      return "בוטלה מאוחר";
    case SessionStatus.UNDOCUMENTED:
      return "לא תועד";
    default:
      return status;
  }
}

function billingLabel(fee: number, paid: number) {
  if (fee <= 0) return "ללא חיוב";
  if (paid >= fee) return "שולם";
  if (paid > 0) return "שולם חלקית";
  return "לא שולם";
}

function billingTone(fee: number, paid: number) {
  if (fee <= 0) return "text-muted";
  if (paid >= fee) return "text-emerald-600";
  if (paid > 0) return "text-amber-600";
  return "text-rose-600";
}
