import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { FigurePageClient } from "@/components/patients/FigurePageClient";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const FIGURE_ROLE_LABELS: Record<string, string> = {
  MOTHER: "אמא",
  FATHER: "אבא",
  SISTER: "אחות",
  BROTHER: "אח",
  PARTNER: "בן/בת זוג",
  FRIEND: "חבר/ה",
  COLLEAGUE: "עמית",
  ACQUAINTANCE: "מכר",
  OTHER: "אחר",
};

export default async function FigurePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const figure = await prisma.patientFigure.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!figure) return notFound();

  // Find sessions where this figure's name appears in the session note markdown
  const sessionNotes = await prisma.sessionNote.findMany({
    where: {
      session: { patientId: figure.patientId },
      markdown: { contains: figure.name },
    },
    include: {
      session: {
        select: {
          id: true,
          scheduledAt: true,
          status: true,
        },
      },
    },
    orderBy: { session: { scheduledAt: "desc" } },
    take: 20,
  });

  const patientName = `${figure.patient.firstName} ${figure.patient.lastName}`;
  const roleLabel = FIGURE_ROLE_LABELS[figure.role] ?? figure.role;

  const appearances = sessionNotes.map((sn) => ({
    sessionId: sn.session.id,
    scheduledAt: sn.session.scheduledAt.toISOString(),
    status: sn.session.status,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton fallback={`/patients/${figure.patientId}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-ink">{figure.name}</h1>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {roleLabel}
            </span>
          </div>
          <p className="text-sm text-muted">
            <Link href={`/patients/${figure.patient.id}`} className="hover:text-accent hover:underline">
              {patientName}
            </Link>
          </p>
        </div>
      </div>

      {/* Editor / main content */}
      <FigurePageClient
        figureId={id}
        initialName={figure.name}
        initialRole={figure.role}
        initialNotes={figure.notes ?? ""}
        patientId={figure.patient.id}
        appearances={appearances}
      />
    </div>
  );
}
