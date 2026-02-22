import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { PatientArchiveMenu } from "@/components/patients/PatientArchiveMenu";
import { PatientAdditionalGrid } from "@/components/patients/PatientAdditionalGrid";
import { PatientAvatarPicker } from "@/components/patients/PatientAvatarPicker";
import { PatientConnectionsGraph } from "@/components/patients/PatientConnectionsGraph";
import { PatientLifecycleTimeline } from "@/components/patients/PatientLifecycleTimeline";
import { PatientReactivationBanner } from "@/components/patients/PatientReactivationBanner";
import { PatientSessionsPanel } from "@/components/patients/PatientSessionsPanel";
import { PatientTasksPanel } from "@/components/patients/PatientTasksPanel";
import { requireCurrentUserId } from "@/lib/auth-server";
import { buildPatientConnectionsGraphData } from "@/lib/patient-connections";
import { fmtTime, fmtDate } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";

export default async function PatientDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;
  const query = await searchParams;

  const patient = await prisma.patient.findFirst({
    where: { id, ownerUserId: userId },
    include: {
      intakes: { orderBy: { createdAt: "desc" }, take: 1 },
      sessions: {
        orderBy: { scheduledAt: "desc" },
        take: 240,
        include: { paymentAllocations: true },
      },
      tasks: { orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }], take: 100 },
      receipts: {
        orderBy: { issuedAt: "desc" },
        include: { paymentAllocations: true },
        take: 20,
      },
      medicalDocuments: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      patientNotes: { orderBy: { createdAt: "desc" }, take: 50 },
      conceptLinks: { orderBy: { createdAt: "desc" }, take: 50 },
      figures: { orderBy: { createdAt: "desc" }, take: 100 },
      ownerUser: { select: { fullName: true } },
      guidances: {
        orderBy: [{ updatedAt: "desc" }],
        take: 50,
        include: {
          instructor: {
            select: { fullName: true },
          },
          sessions: {
            include: {
              session: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
      lifecycleEvents: {
        orderBy: [{ occurredAt: "desc" }],
        take: 120,
        include: {
          actorUser: { select: { fullName: true } },
        },
      },
    },
  });
  const patientLinkedDocumentLinks = await prisma.researchLink.findMany({
    where: {
      targetEntityType: ResearchTargetType.PATIENT,
      targetEntityId: id,
      researchDocumentId: { not: null },
    },
    select: { researchDocumentId: true },
  });
  const patientLinkedDocumentIds = patientLinkedDocumentLinks.flatMap((link) =>
    link.researchDocumentId ? [link.researchDocumentId] : [],
  );

  const linkedResearchNotes = await prisma.researchNote.findMany({
    where:
      patientLinkedDocumentIds.length > 0
        ? {
            OR: [
              {
                links: {
                  some: {
                    targetEntityType: ResearchTargetType.PATIENT,
                    targetEntityId: id,
                  },
                },
              },
              {
                links: {
                  some: {
                    targetEntityType: ResearchTargetType.RESEARCH_DOCUMENT,
                    targetEntityId: { in: patientLinkedDocumentIds },
                  },
                },
              },
            ],
          }
        : {
            links: {
              some: {
                targetEntityType: ResearchTargetType.PATIENT,
                targetEntityId: id,
              },
            },
          },
    include: {
      links: {
        where: {
          targetEntityType: ResearchTargetType.RESEARCH_DOCUMENT,
        },
        select: { targetEntityId: true, targetEntityAlias: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const linkedNoteDocumentIds = Array.from(
    new Set(
      linkedResearchNotes.flatMap((note) =>
        note.links.flatMap((link) => (link.targetEntityId ? [link.targetEntityId] : [])),
      ),
    ),
  );
  const allLinkedDocumentIds = Array.from(new Set([...patientLinkedDocumentIds, ...linkedNoteDocumentIds]));
  const linkedDocuments = allLinkedDocumentIds.length
    ? await prisma.researchDocument.findMany({
        where: { id: { in: allLinkedDocumentIds } },
        select: { id: true, title: true, updatedAt: true },
      })
    : [];
  const linkedNoteDocumentMap = new Map(linkedDocuments.map((doc) => [doc.id, doc.title]));

  if (!patient) return notFound();

  const latestIntake = patient.intakes[0];
  const isInactive = Boolean(patient.archivedAt);
  const debtRows = patient.sessions
    .map((session) => {
      const fee = session.feeNis ?? 0;
      const paid = session.paymentAllocations.reduce((acc, item) => acc + item.amountNis, 0);
      const due = Math.max(0, fee - paid);
      const billable = session.status === "COMPLETED" || session.status === "CANCELED_LATE";
      return { session, due, billable };
    })
    .filter((row) => row.billable && row.due > 0);
  const totalDebt = debtRows.reduce((sum, row) => sum + row.due, 0);

  const age = patient.dateOfBirth ? calcAge(patient.dateOfBirth) : null;
  const treatmentStart = patient.treatmentStartDate ?? patient.createdAt;
  const treatmentMonths = calcTreatmentMonths(treatmentStart);
  const now = new Date();
  const nextSession = resolveNextSession(patient.fixedSessionDay, patient.fixedSessionTime, patient.sessions);
  const inferredDefaultFee = inferDefaultFeeFromSessions(patient.sessions);
  const lifecycleEvents = [
    {
      id: `created-${patient.id}`,
      eventType: "PATIENT_CREATED" as const,
      occurredAt: (patient.treatmentStartDate ?? patient.createdAt).toISOString(),
      reason: "פתיחת תיק מטופל",
      actorName: patient.ownerUser?.fullName ?? null,
      metadata: null,
    },
    ...patient.lifecycleEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      reason: event.reason,
      actorName: event.actorUser?.fullName ?? null,
      metadata:
        event.metadataJson && typeof event.metadataJson === "object" && !Array.isArray(event.metadataJson)
          ? {
              canceledSessionsCount:
                typeof (event.metadataJson as Record<string, unknown>).canceledSessionsCount === "number"
                  ? Number((event.metadataJson as Record<string, unknown>).canceledSessionsCount)
                  : undefined,
              closedTasksCount:
                typeof (event.metadataJson as Record<string, unknown>).closedTasksCount === "number"
                  ? Number((event.metadataJson as Record<string, unknown>).closedTasksCount)
                  : undefined,
            }
          : null,
    })),
  ]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 120);

  const graphData = buildPatientConnectionsGraphData({
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
    },
    sessions: patient.sessions.map((session) => ({
      id: session.id,
      scheduledAt: session.scheduledAt,
      status: session.status,
    })),
    tasks: patient.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      sessionId: task.sessionId ?? null,
      dueAt: task.dueAt ?? null,
      createdAt: task.createdAt,
    })),
    guidances: patient.guidances.map((guidance) => ({
      id: guidance.id,
      title: guidance.title,
      status: guidance.status,
      scheduledAt: guidance.scheduledAt ?? null,
      updatedAt: guidance.updatedAt,
      sessions: guidance.sessions.map((item) => ({ session: { id: item.session.id } })),
    })),
    linkedResearchNotes: linkedResearchNotes.map((note) => ({
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
      documentId: note.links[0]?.targetEntityId ?? null,
      documentTitle:
        note.links[0]?.targetEntityAlias ??
        (note.links[0]?.targetEntityId ? linkedNoteDocumentMap.get(note.links[0].targetEntityId) ?? null : null),
    })),
    linkedResearchDocuments: linkedDocuments.map((doc) => ({
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
    })),
    receipts: patient.receipts.map((receipt) => ({
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      amountNis: receipt.amountNis,
      issuedAt: receipt.issuedAt,
      paymentAllocations: receipt.paymentAllocations.map((allocation) => ({
        sessionId: allocation.sessionId,
      })),
    })),
    conceptLinks: patient.conceptLinks.map((link) => ({
      id: link.id,
      label: link.label,
      href: link.href ?? null,
      updatedAt: link.updatedAt,
    })),
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex items-center">
        <BackButton fallback="/patients" />
      </div>

      <section className="app-section">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <PatientAvatarPicker patientId={patient.id} value={patient.avatarKey ?? ""} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-ink">{`${patient.firstName} ${patient.lastName}`}</h1>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${isInactive ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}
                >
                  {isInactive ? "לא פעיל" : "פעיל"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{patient.phone} · {patient.email ?? "ללא אימייל"}</p>
            </div>
          </div>
          <PatientArchiveMenu
            patientId={patient.id}
            editPatientHref={`/patients/${patient.id}?edit=patient#patient-profile`}
            editLayoutHref={`/patients/${patient.id}#patient-layout`}
            intakeHref={`/patients/${patient.id}/intake`}
            isInactive={isInactive}
          />
        </div>
      </section>

      {isInactive ? <PatientReactivationBanner patientId={patient.id} /> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <InfoCard
          label="גיל"
          value={age ? String(age) : "לא הוגדר"}
          sub={patient.dateOfBirth ? `תאריך לידה: ${patient.dateOfBirth.toLocaleDateString("he-IL")}` : "תאריך לידה לא הוזן"}
        />
        <InfoCard
          label="פגישה הבאה"
          value={nextSession ? fmtDate(nextSession) : "אין פגישה מתוכננת"}
          sub={nextSession ? fmtTime(nextSession) : fixedSessionLabel(patient.fixedSessionDay, patient.fixedSessionTime)}
        />
        <InfoCard label="משך הטיפול" value={formatTreatmentDuration(treatmentMonths)} sub={`מתאריך ${treatmentStart.toLocaleDateString("he-IL")}`} />
        <InfoCard
          label="חוב לתשלום"
          value={`₪${totalDebt.toLocaleString("he-IL")}`}
          sub={`${debtRows.length} פגישות לא שולמו`}
          tone={totalDebt > 0 ? "warn" : "normal"}
          action={
            isInactive ? (
              <span className="mt-2 inline-flex rounded-md bg-black/[0.04] px-2 py-1 text-xs text-muted">לא ניתן להפיק קבלה למטופל לא פעיל</span>
            ) : (
              <Link href={`/receipts/new?patientId=${patient.id}`} className="app-btn app-btn-primary mt-2 text-xs">
                הפקת קבלה
              </Link>
            )
          }
        />
      </section>

      <section id="patient-layout" className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <PatientSessionsPanel
            patientId={patient.id}
            nowIso={now.toISOString()}
            patientInactive={isInactive}
            rows={patient.sessions.map((session) => {
              const fee = session.feeNis ?? 0;
              const paid = session.paymentAllocations.reduce((acc, item) => acc + item.amountNis, 0);
              const billingLabel = fee <= 0 ? "ללא חיוב" : paid >= fee ? "שולם" : paid > 0 ? "שולם חלקית" : "לא שולם";
              const billingTone = fee <= 0 ? "bg-black/[0.04] text-muted" : paid >= fee ? "bg-emerald-100 text-emerald-700" : paid > 0 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
              return {
                id: session.id,
                scheduledAt: session.scheduledAt.toISOString(),
                status: session.status,
                statusLabel: statusLabel(session.status),
                statusTone: statusTone(session.status),
                billingLabel,
                billingTone,
                isFuture: session.scheduledAt.getTime() > now.getTime(),
              };
            })}
          />

          <PatientTasksPanel
            patientId={patient.id}
            patientInactive={isInactive}
            tasks={patient.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              status: task.status,
              dueAt: task.dueAt?.toISOString(),
              completedAt: task.completedAt?.toISOString(),
              sessionId: task.sessionId ?? undefined,
            }))}
          />

          <PatientConnectionsGraph
            data={graphData}
            openGraphHref={`/patients/${patient.id}/graph`}
            variant="embedded"
          />
        </div>

        <PatientAdditionalGrid
          patientId={patient.id}
          startEditingProfile={query.edit === "patient"}
          isInactive={isInactive}
          profileInitial={{
            firstName: patient.firstName,
            lastName: patient.lastName,
            phone: patient.phone,
            email: patient.email ?? "",
            gender: patient.gender,
            dateOfBirth: patient.dateOfBirth ? toDateInput(patient.dateOfBirth) : "",
            fixedSessionDay:
              patient.fixedSessionDay !== null && patient.fixedSessionDay !== undefined
                ? String(patient.fixedSessionDay)
                : "",
            fixedSessionTime: patient.fixedSessionTime ?? "",
            defaultSessionFeeNis: patient.defaultSessionFeeNis
              ? String(patient.defaultSessionFeeNis)
              : inferredDefaultFee
                ? String(inferredDefaultFee)
                : "",
            avatarKey: patient.avatarKey ?? "",
          }}
          goals={latestIntake?.goals ?? null}
          referralReason={latestIntake?.referralReason ?? null}
          previousTherapy={latestIntake?.previousTherapy ?? null}
          currentMedication={latestIntake?.currentMedication ?? null}
          hospitalizations={latestIntake?.hospitalizations ?? null}
          figures={patient.figures.map((f) => ({ id: f.id, name: f.name }))}
          conceptLinks={patient.conceptLinks.map((link) => ({ id: link.id, label: link.label, href: link.href ?? null }))}
          linkedResearchNotes={linkedResearchNotes.map((note) => ({
            id: note.id,
            title: note.title,
            markdown: note.markdown,
            documentId: note.links[0]?.targetEntityId ?? null,
            documentTitle:
              note.links[0]?.targetEntityAlias ??
              (note.links[0]?.targetEntityId ? linkedNoteDocumentMap.get(note.links[0].targetEntityId) ?? null : null),
          }))}
          guidances={patient.guidances.map((guidance) => ({
            id: guidance.id,
            title: guidance.title,
            scheduledAt: guidance.scheduledAt ? guidance.scheduledAt.toISOString() : null,
            instructorName: guidance.instructor?.fullName ?? null,
          }))}
          notes={patient.patientNotes.map((note) => ({ id: note.id, title: note.title, content: note.content }))}
        />
      </section>

      <PatientLifecycleTimeline
        events={lifecycleEvents}
        sessions={patient.sessions.map((session) => ({
          id: session.id,
          scheduledAt: session.scheduledAt.toISOString(),
          status: session.status,
        }))}
      />
    </main>
  );
}

function InfoCard({ label, value, sub, tone = "normal", action }: { label: string; value: string; sub?: string; tone?: "normal" | "warn"; action?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "warn" ? "border-warn/30 bg-warn/10" : "border-black/10 bg-white/95"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold text-ink">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
      {action}
    </div>
  );
}

function calcAge(dob: Date) {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return Math.max(age, 0);
}

function calcTreatmentMonths(start: Date) {
  const today = new Date();
  let months = (today.getFullYear() - start.getFullYear()) * 12;
  months += today.getMonth() - start.getMonth();
  if (today.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

function formatTreatmentDuration(months: number) {
  if (months < 12) return `${months} חודשים`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return years === 1 ? "שנה" : `${years} שנים`;
  if (rest === 6) return years === 1 ? "שנה וחצי" : `${years} שנים וחצי`;
  if (years === 1) return `שנה ו-${rest} חודשים`;
  return `${years} שנים ו-${rest} חודשים`;
}

function fixedSessionLabel(day: number | null, time: string | null) {
  if (day === null || day === undefined) return "לא הוגדר";
  const days = ["שבת", "ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];
  return `יום ${days[day] ?? "לא ידוע"}${time ? ` · ${time}` : ""}`;
}

function resolveNextSession(day: number | null, time: string | null, sessions: Array<{ scheduledAt: Date; status: string }>) {
  const now = new Date();
  const future = sessions
    .filter((s) => s.scheduledAt.getTime() > now.getTime() && s.status !== "CANCELED" && s.status !== "CANCELED_LATE")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];
  if (future) return future.scheduledAt;

  if (day === null || day === undefined || !time) return null;
  const [h, m] = time.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

  // All Date arithmetic must account for Israel timezone (UTC+2 / UTC+3 DST).
  // On Vercel (UTC), getDay()/setHours() would operate in UTC — wrong.
  // Instead: use Intl to extract Israel wall-clock date parts, then build a
  // UTC timestamp by parsing "YYYY-MM-DDThh:mm" as an Israel local time via
  // a known-offset string (Intl gives us the exact UTC offset).
  const TZ = "Asia/Jerusalem";

  // Get Israel wall-clock parts for "now"
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? "0";
  const ilYear = Number(p("year"));
  const ilMonth = Number(p("month")); // 1-based
  const ilDay = Number(p("day"));
  const ilHour = Number(p("hour")) % 24; // "24" → 0 on some engines
  const ilMinute = Number(p("minute"));

  // Day-of-week in Israel (0=Sun … 6=Sat)
  const ilDow = new Date(now).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
  const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const ilTodayDow = DOW[ilDow] ?? 0;

  // Compute Israel UTC offset at "now" (in minutes, positive = ahead of UTC)
  // by comparing UTC interpretation of an IL-date-string vs actual UTC
  const ilDateStr = `${ilYear}-${String(ilMonth).padStart(2, "0")}-${String(ilDay).padStart(2, "0")}`;
  const utcMidnightMs = Date.UTC(ilYear, ilMonth - 1, ilDay); // midnight UTC of IL calendar date
  // IL midnight as UTC: parse "YYYY-MM-DDT00:00:00Z" vs the actual UTC at IL midnight
  // Easier: offset = UTC timestamp when IL shows hh:mm minus UTC timestamp of same hh:mm read as UTC
  const ilNowAsIfUTC = Date.UTC(ilYear, ilMonth - 1, ilDay, ilHour, ilMinute);
  const ilOffsetMs = ilNowAsIfUTC - now.getTime(); // positive → IL ahead of UTC (e.g. 7200000 for UTC+2)

  // Build "today in IL at h:m" as a UTC timestamp
  const todayAtTimeMs = Date.UTC(ilYear, ilMonth - 1, ilDay, h, m) - ilOffsetMs;
  const todayAtTime = new Date(todayAtTimeMs);

  // How many days until the target weekday?
  let delta = (day - ilTodayDow + 7) % 7;
  // If same weekday but the time has already passed today, go to next week
  if (delta === 0 && todayAtTime.getTime() <= now.getTime()) delta = 7;

  return new Date(todayAtTime.getTime() + delta * 86400000);
}

function statusLabel(status: string) {
  if (status === "COMPLETED") return "תועדה";
  if (status === "UNDOCUMENTED") return "לתיעוד";
  if (status === "CANCELED_LATE") return "בוטלה מאוחר";
  if (status === "CANCELED") return "בוטלה";
  return "נקבעה";
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (status === "UNDOCUMENTED") return "bg-rose-100 text-rose-700";
  if (status === "CANCELED_LATE") return "bg-amber-100 text-amber-700";
  return "bg-black/[0.04] text-muted";
}

function toDateInput(date: Date) {
  // Use Israel timezone so the date shown in the input matches the local calendar date,
  // not the UTC date (which can differ by a day for times stored near midnight).
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }); // "YYYY-MM-DD"
}

function inferDefaultFeeFromSessions(sessions: Array<{ feeNis: number | null }>) {
  const counts = new Map<number, number>();
  for (const session of sessions) {
    const fee = session.feeNis ?? 0;
    if (fee <= 0) continue;
    counts.set(fee, (counts.get(fee) ?? 0) + 1);
  }
  let bestFee: number | null = null;
  let bestCount = 0;
  for (const [fee, count] of counts) {
    if (count > bestCount) {
      bestFee = fee;
      bestCount = count;
    }
  }
  return bestFee;
}
