import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { GuidanceEditor } from "@/components/guidance/GuidanceEditor";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";

export default async function GuidanceItemPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const guidance = await prisma.guidance.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      instructor: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
        },
      },
      sessions: {
        include: {
          session: {
            select: {
              id: true,
              scheduledAt: true,
              status: true,
              location: true,
              sessionNote: {
                select: { markdown: true },
              },
            },
          },
        },
      },
    },
  });
  if (!guidance) return notFound();

  const selectedSessionIds = guidance.sessions.map((item) => item.session.id);
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const [instructors, recentCompletedSessions, linkedSessions] = await Promise.all([
    prisma.instructor.findMany({
      where: { ownerUserId: userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
      },
      orderBy: [{ fullName: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.session.findMany({
      where: {
        patientId: guidance.patientId,
        patient: { ownerUserId: userId },
        status: "COMPLETED",
        scheduledAt: { gte: monthAgo },
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        location: true,
        sessionNote: {
          select: { markdown: true },
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: 120,
    }),
    selectedSessionIds.length
      ? prisma.session.findMany({
          where: {
            id: { in: selectedSessionIds },
            patient: { ownerUserId: userId },
          },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            location: true,
            sessionNote: {
              select: { markdown: true },
            },
          },
          orderBy: { scheduledAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const mergedSessions = (() => {
    const map = new Map<string, (typeof recentCompletedSessions)[number]>();
    for (const session of [...recentCompletedSessions, ...linkedSessions]) {
      map.set(session.id, session);
    }
    return [...map.values()].sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  })();

  const linkedSessionSet = new Set(selectedSessionIds);
  const sortedSessions = [
    ...mergedSessions.filter((session) => linkedSessionSet.has(session.id)),
    ...mergedSessions.filter((session) => !linkedSessionSet.has(session.id)),
  ];

  const recentCompletedCount = recentCompletedSessions.length;

  return (
    <main className="space-y-4">
      <BackButton fallback="/guidance" />
      <GuidanceEditor
        guidanceId={guidance.id}
        recentCompletedCount={recentCompletedCount}
        initialData={{
          title: guidance.title,
          scheduledAt: guidance.scheduledAt ? toDateTimeInput(guidance.scheduledAt) : "",
          status: guidance.status,
          feeNis: guidance.feeNis,
          completedAt: guidance.completedAt ? toDateTimeInput(guidance.completedAt) : "",
          contentMarkdown: guidance.contentMarkdown,
          notesMarkdown: guidance.notesMarkdown,
          instructorId: guidance.instructorId ?? "",
          patient: {
            id: guidance.patient.id,
            name: formatPatientName(guidance.patient.firstName, guidance.patient.lastName),
          },
          selectedSessionIds,
          attachmentFileName: guidance.attachmentFileName,
          attachmentMimeType: guidance.attachmentMimeType,
          attachmentFilePath: guidance.attachmentFilePath,
          updatedAt: guidance.updatedAt.toISOString(),
        }}
        instructors={instructors.map((item) => ({
          id: item.id,
          fullName: item.fullName,
          phone: item.phone,
          email: item.email,
        }))}
        sessions={sortedSessions.map((session) => ({
          id: session.id,
          scheduledAt: session.scheduledAt.toISOString(),
          status: session.status,
          location: session.location ?? "",
          notePreview: session.sessionNote?.markdown ?? "",
        }))}
      />
    </main>
  );
}

function toDateTimeInput(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
