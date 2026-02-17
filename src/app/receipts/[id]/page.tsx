import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { EntityLink } from "@/components/EntityLink";
import { ArchiveReceiptButton } from "@/components/receipts/ArchiveReceiptButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";

export default async function ReceiptDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const receipt = await prisma.receipt.findFirst({
    where: { id, archivedAt: null, patient: { ownerUserId: userId } },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      paymentAllocations: {
        include: {
          session: {
            select: {
              id: true,
              scheduledAt: true,
              feeNis: true,
              patient: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!receipt) return notFound();

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4">
      <BackButton fallback="/receipts" />

      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold">קבלה {receipt.receiptNumber}</h1>
          <ArchiveReceiptButton receiptId={receipt.id} />
        </div>
        <p className="mt-1 text-sm text-muted">תאריך הפקה: {receipt.issuedAt.toLocaleDateString("he-IL")}</p>
        <div className="mt-1 text-sm">
          <EntityLink
            type="patient"
            id={receipt.patient.id}
            label={formatPatientName(receipt.patient.firstName, receipt.patient.lastName)}
          />
        </div>
        <p className="mt-2 text-lg font-semibold text-ink">סה״כ: ₪{receipt.amountNis}</p>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">פגישות ששויכו לקבלה</h2>
        <div className="space-y-2">
          {receipt.paymentAllocations.map((allocation) => (
            <EntityLink
              key={allocation.id}
              type="session"
              id={allocation.session.id}
              label={`${formatPatientName(allocation.session.patient.firstName, allocation.session.patient.lastName)} · ${allocation.session.scheduledAt.toLocaleDateString("he-IL")} ${allocation.session.scheduledAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`}
              variant="compact"
              meta={`מחיר: ₪${allocation.session.feeNis ?? 0}`}
              status={{ text: `שולם ₪${allocation.amountNis}`, tone: "bg-emerald-100 text-emerald-700" }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
