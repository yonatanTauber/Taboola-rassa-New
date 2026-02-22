import { GuidanceStatus, SessionStatus } from "@prisma/client";
import Link from "next/link";
import { QuickActionButton } from "@/components/QuickActionButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { markUndocumentedSessions } from "@/lib/maintenance";
import { formatPatientName } from "@/lib/patient-name";
import { fmtTime, fmtDateShort } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  await markUndocumentedSessions(userId);

  const params = (await searchParams) ?? {};
  const view = typeof params.view === "string" ? params.view : "today";
  const patientIdFilter = typeof params.patientId === "string" ? params.patientId : "";
  const statusFilter = typeof params.status === "string" ? params.status : "";

  const { start, end } = view === "week" ? getWeekRange() : getDayRange();

  const sessions = await prisma.session.findMany({
      where: {
        patient: { ownerUserId: userId },
        ...(patientIdFilter ? { patientId: patientIdFilter } : {}),
        ...(statusFilter === "canceled"
          ? { status: { in: [SessionStatus.CANCELED, SessionStatus.CANCELED_LATE] } }
          : {}),
        scheduledAt: {
          gte: start,
          lte: end,
        },
      },
      include: { patient: true, paymentAllocations: true },
      orderBy: { scheduledAt: "asc" },
    });

  const guidances =
    statusFilter === "canceled"
      ? []
      : await prisma.guidance.findMany({
          where: {
            patient: { ownerUserId: userId },
            ...(patientIdFilter ? { patientId: patientIdFilter } : {}),
            scheduledAt: {
              gte: start,
              lte: end,
            },
          },
          include: {
            patient: true,
            instructor: {
              select: { fullName: true },
            },
          },
          orderBy: { scheduledAt: "asc" },
        });

  const agendaItems = [
    ...sessions.map((session) => ({
      kind: "SESSION" as const,
      key: session.id,
      scheduledAt: session.scheduledAt,
      session,
    })),
    ...guidances
      .filter((guidance) => guidance.scheduledAt)
      .map((guidance) => ({
        kind: "GUIDANCE" as const,
        key: guidance.id,
        scheduledAt: guidance.scheduledAt as Date,
        guidance,
      })),
  ].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return (
    <main className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
      <section className="app-section">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">פגישות {view === "week" ? "השבוע" : "היום"}</h1>
          <div className="flex gap-1 rounded-lg border border-black/10 p-1 text-xs">
            <Link href="/sessions?view=today" className={`rounded-md px-2 py-1 ${view === "today" ? "bg-accent-soft text-accent" : "text-muted"}`}>
              יומי
            </Link>
            <Link href="/sessions?view=week" className={`rounded-md px-2 py-1 ${view === "week" ? "bg-accent-soft text-accent" : "text-muted"}`}>
              שבועי
            </Link>
            <Link
              href={`/sessions?view=${view}&status=canceled${patientIdFilter ? `&patientId=${patientIdFilter}` : ""}`}
              className={`rounded-md px-2 py-1 ${statusFilter === "canceled" ? "bg-accent-soft text-accent" : "text-muted"}`}
            >
              ביטולים
            </Link>
          </div>
        </div>

        {agendaItems.length > 0 ? (
          <ul className="space-y-2">
            {agendaItems.map((item) =>
              item.kind === "SESSION" ? (
                <li key={`session-${item.key}`}>
                  <Link href={`/sessions/${item.session.id}`} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 rounded-xl border border-black/10 px-3 py-2 hover:bg-black/[0.02]">
                    <div className="font-mono tabular-nums text-sm text-muted">
                      {fmtDateShort(item.session.scheduledAt)}
                      <br />
                      {fmtTime(item.session.scheduledAt)}
                    </div>
                    <div>
                      <p className="font-medium text-ink">{formatPatientName(item.session.patient.firstName, item.session.patient.lastName)}</p>
                      <p className="text-xs text-muted">{item.session.location ?? "ללא מיקום"}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-ink">{statusLabel(item.session.status)}</p>
                      <p className={`text-xs ${billingTone(item.session.feeNis ?? 0, item.session.paymentAllocations.reduce((sum, p) => sum + p.amountNis, 0))}`}>
                        {billingLabel(item.session.feeNis ?? 0, item.session.paymentAllocations.reduce((sum, p) => sum + p.amountNis, 0))}
                      </p>
                    </div>
                  </Link>
                </li>
              ) : (
                <li key={`guidance-${item.key}`}>
                  <Link href={`/guidance/${item.guidance.id}`} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-2 hover:bg-blue-50">
                    <div className="font-mono tabular-nums text-sm text-muted">
                      {fmtDateShort(item.scheduledAt)}
                      <br />
                      {fmtTime(item.scheduledAt)}
                    </div>
                    <div>
                      <p className="font-medium text-ink">
                        הדרכה: {item.guidance.title}
                      </p>
                      <p className="text-xs text-muted">
                        {formatPatientName(item.guidance.patient.firstName, item.guidance.patient.lastName)}
                        {item.guidance.instructor?.fullName ? ` · מדריך: ${item.guidance.instructor.fullName}` : ""}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-ink">פגישת הדרכה</p>
                      <p className="text-xs text-muted">{guidanceStatusLabel(item.guidance.status)}</p>
                    </div>
                  </Link>
                </li>
              ),
            )}
          </ul>
        ) : <p className="text-sm text-muted">אין פגישות בטווח הזה.</p>}
      </section>

      <section className="space-y-3">
        <div className="app-section">
          <h2 className="mb-3 text-lg font-semibold">פעולות מהירות</h2>
          <div className="grid grid-cols-2 gap-2">
            <QuickActionButton
              action="session"
              label="פגישה חדש"
              className="app-btn app-btn-secondary w-full"
            />
            <QuickActionButton
              action="task"
              label="משימה חדשה"
              className="app-btn app-btn-secondary w-full"
            />
          </div>
        </div>

        <div className="app-section">
          <h2 className="mb-3 text-lg font-semibold">כללי מערכת לפגישות</h2>
          <ul className="mb-3 space-y-2 text-sm text-ink">
            <li className="rounded-lg bg-black/[0.02] px-3 py-2">פגישה שעבר זמנה ללא תיעוד תסומן: לא תועד</li>
            <li className="rounded-lg bg-black/[0.02] px-3 py-2">תזכורת תיעוד חסר תופיע יום לאחר מכן</li>
          </ul>
          <p className="text-xs text-muted">המערכת מעדכנת אוטומטית פגישות לא מתועדות ללא פעולה ידנית.</p>
        </div>
      </section>
    </main>
  );
}

function getDayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function statusLabel(status: SessionStatus) {
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

function guidanceStatusLabel(status: GuidanceStatus) {
  return status === GuidanceStatus.COMPLETED ? "הושלמה" : "פעילה";
}
