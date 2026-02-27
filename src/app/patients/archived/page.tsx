import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { UnarchiveButton } from "./UnarchiveButton";

export default async function ArchivedPatientsPage() {
  const userId = await requireCurrentUserId();
  if (!userId) return null;

  const patients = await prisma.patient.findMany({
    where: { ownerUserId: userId, archivedAt: { not: null } },
    orderBy: [{ archivedAt: "desc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      archivedAt: true,
      treatmentStartDate: true,
      _count: {
        select: { sessions: true },
      },
    },
  });

  return (
    <main className="space-y-4">
      <BackButton fallback="/patients" />

      <section className="app-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">מטופלים בארכיון</h1>
            <p className="mt-0.5 text-sm text-muted">{patients.length} מטופלים מאורכבים</p>
          </div>
          <Link href="/patients" className="app-btn app-btn-secondary text-sm">
            חזרה לרשימה הפעילה
          </Link>
        </div>
      </section>

      {patients.length === 0 ? (
        <section className="app-section flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-lg font-medium">אין מטופלים בארכיון</p>
          <p className="text-sm text-muted">מטופלים שסומנו כלא פעילים יופיעו כאן</p>
          <Link href="/patients" className="app-btn app-btn-primary mt-2">
            לרשימת מטופלים
          </Link>
        </section>
      ) : (
        <section className="app-section overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/8 bg-black/[0.02] text-right text-xs text-muted">
                  <th className="px-4 py-2 font-medium">שם</th>
                  <th className="px-4 py-2 font-medium">טלפון</th>
                  <th className="px-4 py-2 font-medium">פגישות</th>
                  <th className="px-4 py-2 font-medium">תאריך אורכוב</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {patients.map((patient) => (
                  <tr key={patient.id} className="group hover:bg-black/[0.01]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {patient.firstName} {patient.lastName}
                      </Link>
                      {patient.email && (
                        <div className="text-xs text-muted">{patient.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {patient.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {patient._count.sessions}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {patient.archivedAt
                        ? patient.archivedAt.toLocaleDateString("he-IL")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <UnarchiveButton patientId={patient.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
