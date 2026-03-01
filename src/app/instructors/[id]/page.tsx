import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";

const GUIDANCE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "פעילה",
  COMPLETED: "הושלמה",
  CANCELED: "בוטלה",
};

export default async function InstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const instructor = await prisma.instructor.findFirst({
    where: { id, ownerUserId: userId },
    include: {
      guidances: {
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 100,
      },
    },
  });
  if (!instructor) notFound();

  return (
    <main className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl font-semibold text-ink">{instructor.fullName}</h1>
      </div>

      <section className="app-section space-y-1.5">
        {instructor.phone && (
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">טלפון:</span>{" "}
            <a href={`tel:${instructor.phone}`} className="text-accent hover:underline">
              {instructor.phone}
            </a>
          </p>
        )}
        {instructor.email && (
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">מייל:</span>{" "}
            <a href={`mailto:${instructor.email}`} className="text-accent hover:underline">
              {instructor.email}
            </a>
          </p>
        )}
      </section>

      <section className="app-section">
        <h2 className="mb-3 text-base font-semibold text-ink">
          הדרכות ({instructor.guidances.length})
        </h2>
        {instructor.guidances.length === 0 ? (
          <p className="text-sm text-muted">אין הדרכות.</p>
        ) : (
          <ul className="space-y-2">
            {instructor.guidances.map((guidance) => (
              <li key={guidance.id}>
                <Link
                  href={`/guidance/${guidance.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-white px-3 py-2.5 hover:bg-black/[0.02]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{guidance.title}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {formatPatientName(guidance.patient.firstName, guidance.patient.lastName)}
                      {guidance.scheduledAt && (
                        <>
                          {" · "}
                          {new Date(guidance.scheduledAt).toLocaleDateString("he-IL")}
                        </>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-muted">
                    {GUIDANCE_STATUS_LABELS[guidance.status] ?? guidance.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
