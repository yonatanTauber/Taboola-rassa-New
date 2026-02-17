import { BackButton } from "@/components/BackButton";
import { NewReceiptForm } from "@/components/receipts/NewReceiptForm";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const initialPatientId = typeof params.patientId === "string" ? params.patientId : "";
  const userId = await requireCurrentUserId();
  if (!userId) return null;

  const patients = await prisma.patient.findMany({
    where: { ownerUserId: userId, archivedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500,
  });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4">
      <BackButton fallback="/sessions" />
      <NewReceiptForm patients={patients.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))} initialPatientId={initialPatientId} />
    </main>
  );
}
