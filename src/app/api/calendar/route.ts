import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth-server";
import { TaskStatus } from "@prisma/client";

function formatPatientName(first: string, last: string) {
  return `${first} ${last}`.trim();
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const rangeStart = new Date(from);
  const rangeEnd = new Date(to);

  const [sessions, guidances, tasks] = await Promise.all([
    prisma.session.findMany({
      where: {
        patient: { ownerUserId: userId },
        scheduledAt: { gte: rangeStart, lte: rangeEnd },
      },
      include: { patient: true },
      orderBy: { scheduledAt: "asc" },
      take: 500,
    }),
    prisma.guidance.findMany({
      where: {
        patient: { ownerUserId: userId },
        scheduledAt: { gte: rangeStart, lte: rangeEnd },
      },
      include: { patient: true, instructor: { select: { fullName: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    }),
    prisma.task.findMany({
      where: {
        status: TaskStatus.OPEN,
        dueAt: { gte: rangeStart, lte: rangeEnd },
        OR: [
          { ownerUserId: userId },
          { patient: { ownerUserId: userId } },
          { session: { patient: { ownerUserId: userId } } },
        ],
      },
      include: { patient: true, session: true },
      orderBy: { dueAt: "asc" },
      take: 500,
    }),
  ]);

  const calendarSessions = [
    ...sessions.map((s) => ({
      id: s.id,
      patient: formatPatientName(s.patient.firstName, s.patient.lastName),
      patientId: s.patient.id,
      startIso: s.scheduledAt.toISOString(),
      statusLabel: s.status,
      href: `/sessions/${s.id}`,
      kind: "session" as const,
      title: "פגישה",
    })),
    ...guidances
      .filter((g) => g.scheduledAt)
      .map((g) => ({
        id: g.id,
        patient: formatPatientName(g.patient.firstName, g.patient.lastName),
        patientId: g.patient.id,
        startIso: (g.scheduledAt as Date).toISOString(),
        statusLabel: g.status,
        href: `/guidance/${g.id}`,
        kind: "guidance" as const,
        title: `הדרכה${g.instructor?.fullName ? ` · ${g.instructor.fullName}` : ""}`,
      })),
  ].sort((a, b) => +new Date(a.startIso) - +new Date(b.startIso));

  const calendarTasks = tasks
    .filter((t): t is typeof t & { dueAt: Date } => Boolean(t.dueAt))
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueIso: t.dueAt.toISOString(),
      patient: t.patient ? formatPatientName(t.patient.firstName, t.patient.lastName) : undefined,
      sessionId: t.sessionId ?? undefined,
    }));

  return NextResponse.json({ sessions: calendarSessions, tasks: calendarTasks });
}
