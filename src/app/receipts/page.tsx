import { prisma } from "@/lib/prisma";
import { formatPatientName } from "@/lib/patient-name";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { requireCurrentUserId } from "@/lib/auth-server";

export type UnpaidRow = {
  sessionId: string;
  scheduledAt: string; // ISO UTC
  patientId: string;
  patientName: string;
  feeNis: number;
  paidNis: number;
  outstandingNis: number;
};

export default async function ReceiptsPage() {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const expenseClient = (prisma as unknown as {
    expense?: {
      findMany: (args: {
        where?: { guidance?: { patient?: { ownerUserId?: string } } };
        orderBy: { occurredAt: "asc" | "desc" };
        take: number;
      }) => Promise<{ id: string; title: string; amountNis: number; category: string | null; occurredAt: Date }[]>;
    };
  }).expense;
  const [receipts, expenses, billableSessions] = await Promise.all([
    prisma.receipt.findMany({
      where: { archivedAt: null, patient: { ownerUserId: userId } },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        paymentAllocations: true,
      },
      orderBy: { issuedAt: "desc" },
      take: 200,
    }),
    expenseClient
      ? expenseClient.findMany({
          where: { guidance: { patient: { ownerUserId: userId } } },
          orderBy: { occurredAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    prisma.session.findMany({
      where: {
        patient: { ownerUserId: userId, archivedAt: null },
        status: { in: ["COMPLETED", "CANCELED_LATE"] },
        feeNis: { not: null },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        paymentAllocations: { select: { amountNis: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 1000,
    }),
  ]);

  // Build unpaid rows: sessions where paid < fee
  const unpaidSessions: UnpaidRow[] = billableSessions
    .map((s) => {
      const fee = Number(s.feeNis);
      const paid = s.paymentAllocations.reduce((sum, a) => sum + a.amountNis, 0);
      const outstanding = Math.max(0, fee - paid);
      return {
        sessionId: s.id,
        scheduledAt: s.scheduledAt.toISOString(),
        patientId: s.patient.id,
        patientName: formatPatientName(s.patient.firstName, s.patient.lastName),
        feeNis: fee,
        paidNis: paid,
        outstandingNis: outstanding,
      };
    })
    .filter((row) => row.outstandingNis > 0);

  return (
    <FinanceDashboard
      receipts={receipts.map((r) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        issuedAt: r.issuedAt.toISOString(),
        patientId: r.patient.id,
        patientName: formatPatientName(r.patient.firstName, r.patient.lastName),
        amountNis: r.amountNis,
        allocations: r.paymentAllocations.length,
      }))}
      expenses={expenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amountNis: e.amountNis,
        occurredAt: e.occurredAt.toISOString(),
      }))}
      unpaidSessions={unpaidSessions}
    />
  );
}
