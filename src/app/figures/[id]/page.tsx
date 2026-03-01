import Link from "next/link";
import { notFound } from "next/navigation";
import { FigurePageClient } from "@/components/patients/FigurePageClient";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";

export default async function FigureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const figure = await prisma.patientFigure.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: { patient: true },
  });
  if (!figure) notFound();

  // Find session notes that mention the figure's name
  const sessionNotes = await prisma.sessionNote.findMany({
    where: {
      markdown: { contains: figure.name },
      session: { patientId: figure.patientId },
    },
    include: {
      session: {
        select: { id: true, scheduledAt: true, status: true },
      },
    },
    orderBy: { session: { scheduledAt: "desc" } },
    take: 50,
  });

  return (
    <FigurePageClient
      name={figure.name}
      role={figure.role}
      notes={figure.notes ?? null}
      patientId={figure.patientId}
      patientName={formatPatientName(figure.patient.firstName, figure.patient.lastName)}
      appearances={sessionNotes.map((sn) => ({
        sessionId: sn.session.id,
        scheduledAt: sn.session.scheduledAt.toISOString(),
        status: sn.session.status,
        markdown: sn.markdown,
      }))}
    />
  );
}
