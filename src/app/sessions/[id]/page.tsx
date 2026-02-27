import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { EntityLink } from "@/components/EntityLink";
import { SessionReceiptsPager } from "@/components/SessionReceiptsPager";
import { SessionEditor } from "@/components/SessionEditor";
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

      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">משימות קשורות</h2>
          <Link
            href={`/tasks/new?sessionId=${session.id}`}
            className="app-btn app-btn-primary text-xs px-2 py-1"
          >
            +
          </Link>
        </div>
        <ul className="space-y-2 text-sm">
          {session.tasks.map((t) => (
            <li key={t.id}>
              <EntityLink
                type="task"
                id={t.id}
                label={t.title}
                variant="compact"
                meta={
                  t.status === "DONE"
                    ? `בוצעה ${t.completedAt ? t.completedAt.toLocaleDateString("he-IL") : ""}`
                    : t.dueAt ? `לביצוע: ${t.dueAt.toLocaleDateString("he-IL")}` : "ללא תאריך"
                }
                status={
                  t.status === "DONE"
                    ? { text: "בוצעה", tone: "bg-emerald-100 text-emerald-700" }
                    : { text: "פתוחה", tone: "bg-rose-100 text-rose-700" }
                }
              />
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted">מסמכים רפואיים מקושרים</h3>
          <Link
            href={`/medical-documents/new?patientId=${session.patient.id}&sessionId=${session.id}`}
            className="app-btn app-btn-secondary text-xs px-2 py-1"
          >
            +
          </Link>
        </div>
        <ul className="mb-3 space-y-2 text-sm">
          {session.medicalDocuments.length > 0 ? (
            session.medicalDocuments.map((doc) => (
              <li key={doc.id}>
                <EntityLink
                  type="medical-document"
                  id={doc.id}
                  label={doc.title}
                  variant="compact"
                  href={doc.filePath}
                  external
                />
              </li>
            ))
          ) : (
            <li className="rounded-lg bg-black/[0.02] px-3 py-2 text-muted">אין מסמכים רפואיים מקושרים</li>
          )}
        </ul>
        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted">קבלות משויכות</h3>
          <Link
            href={`/receipts/new?sessionId=${session.id}`}
            className="app-btn app-btn-secondary text-xs px-2 py-1"
          >
            +
          </Link>
        </div>
        <ul className="mb-3 space-y-2 text-sm">
          <SessionReceiptsPager
            items={session.paymentAllocations.map((allocation) => ({
              id: allocation.id,
              receiptId: allocation.receipt.id,
              receiptNumber: allocation.receipt.receiptNumber,
              amountNis: allocation.amountNis,
            }))}
          />
        </ul>
        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted">הדרכות מקושרות</h3>
          <Link
            href={`/patients/${session.patient.id}/guidance?sessionId=${session.id}`}
            className="app-btn app-btn-secondary text-xs px-2 py-1"
          >
            +
          </Link>
        </div>
        <ul className="mb-3 space-y-2 text-sm">
          {session.guidanceLinks.length > 0 ? (
            session.guidanceLinks.map((link) => (
              <li key={link.guidanceId}>
                <EntityLink
                  type="guidance"
                  id={link.guidance.id}
                  label={link.guidance.title}
                  variant="compact"
                  meta={`${link.guidance.scheduledAt ? link.guidance.scheduledAt.toLocaleDateString("he-IL") : "ללא מועד"}${link.guidance.instructor?.fullName ? ` · ${link.guidance.instructor.fullName}` : ""}`}
                />
              </li>
            ))
          ) : (
            <li className="rounded-lg bg-black/[0.02] px-3 py-2 text-muted">אין הדרכות מקושרות</li>
          )}
        </ul>
      </section>
    </main>
  );
}

function toDateTimeInput(date: Date) {
  // Return raw UTC ISO string — SessionEditor (client) will convert to local time
  return date.toISOString().slice(0, 16);
}
