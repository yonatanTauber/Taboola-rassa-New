import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { canUseDailyV1 } from "@/lib/daily-feature";
import { listDailyEntries } from "@/lib/daily-service";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";
import { DailyWorkspace } from "@/components/daily/DailyWorkspace";

export default async function DailyPage() {
  const user = await getCurrentUser();
  if (!user?.id) return notFound();
  if (!canUseDailyV1(user.email)) return notFound();

  const [patients, entries] = await Promise.all([
    prisma.patient.findMany({
      where: { ownerUserId: user.id, archivedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500,
    }),
    listDailyEntries(user.id, 80),
  ]);

  return (
    <DailyWorkspace
      patients={patients.map((patient) => ({
        id: patient.id,
        label: formatPatientName(patient.firstName, patient.lastName),
      }))}
      initialEntries={entries}
    />
  );
}
