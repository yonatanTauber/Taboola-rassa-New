import { prisma } from "@/lib/prisma";
import { formatPatientName } from "@/lib/patient-name";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { requireCurrentUserId } from "@/lib/auth-server";

export default async function ReceiptsPage() {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const expenseClient = (prisma as unknown as { expense?: { findMany: (args: { orderBy: { occurredAt: "asc" | "desc" }; take: number }) => Promise<{ id: string; title: string; amountNis: number; category: string | null; occurredAt: Date }[]> } }).expense;
  const [receipts, expenses] = await Promise.all([
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
      ? expenseClient.findMany({ orderBy: { occurredAt: "desc" }, take: 200 })
      : Promise.resolve([]),
  ]);

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
    />
  );
}
