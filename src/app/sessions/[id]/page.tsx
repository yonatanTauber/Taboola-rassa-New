import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { EntityLink } from "@/components/EntityLink";
import { SessionEditor } from "@/components/SessionEditor";
import { SessionSidebarPanel } from "@/components/SessionSidebarPanel";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { fmtDate } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";

export default async function SessionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const session = await prisma.session.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    include: {
      patient: true,
      sessionNote: true,
      tasks: true,
      paymentAllocations: {
        include: {
          receipt: true,
        },
      },
      medicalDocuments: true,
      guidanceLinks: {
        include: {
          guidance: {
            include: {
              instructor: {
                select: { fullName: true },
              },
            },
          },
        },
      },
    },
  });

  if (!session) return notFound();

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1.3fr_1fr]">
      <section className="space-y-4">
        <BackButton fallback="/sessions" />

        <SessionEditor
          session={{
            id: session.id,
            status: session.status,
            location: session.location ?? "",
            feeNis: session.feeNis ? String(session.feeNis) : "",
            scheduledAt: toDateTimeInput(session.scheduledAt),
            note: session.sessionNote?.markdown ?? "",
          }}
        />

        <section className="rounded-2xl border border-black/10 bg-white p-4 text-sm">
          <EntityLink
            type="patient"
            id={session.patient.id}
            label={formatPatientName(session.patient.firstName, session.patient.lastName)}
          />
          <div className="mt-2 text-muted">פגישה בתאריך {fmtDate(session.scheduledAt)}</div>
        </section>
      </section>

      <SessionSidebarPanel
        sessionId={session.id}
        patientId={session.patient.id}
        feeNis={session.feeNis ? String(session.feeNis) : ""}
        tasks={session.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          completedAt: t.completedAt ? t.completedAt.toISOString() : null,
          dueAt: t.dueAt ? t.dueAt.toISOString() : null,
        }))}
        medicalDocuments={session.medicalDocuments.map((doc) => ({
          id: doc.id,
          title: doc.title,
          filePath: doc.filePath,
        }))}
        paymentAllocations={session.paymentAllocations.map((allocation) => ({
          id: allocation.id,
          receiptId: allocation.receipt.id,
          receiptNumber: allocation.receipt.receiptNumber,
          amountNis: allocation.amountNis,
        }))}
        guidanceLinks={session.guidanceLinks.map((link) => ({
          guidanceId: link.guidance.id,
          guidanceTitle: link.guidance.title,
          scheduledAt: link.guidance.scheduledAt ? link.guidance.scheduledAt.toISOString() : null,
          instructorName: link.guidance.instructor?.fullName ?? null,
        }))}
      />
    </main>
  );
}

function toDateTimeInput(date: Date) {
  // Return raw UTC ISO string — SessionEditor (client) will convert to local time
  return date.toISOString().slice(0, 16);
}
