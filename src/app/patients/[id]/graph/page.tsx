import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { PatientConnectionsGraph } from "@/components/patients/PatientConnectionsGraph";
import { requireCurrentUserId } from "@/lib/auth-server";
import { buildPatientConnectionsGraphData } from "@/lib/patient-connections";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";

export default async function PatientGraphPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;
  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { id, archivedAt: null, ownerUserId: userId },
    include: {
      sessions: {
        orderBy: { scheduledAt: "desc" },
        take: 240,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
        },
      },
      tasks: {
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          title: true,
          status: true,
          sessionId: true,
          dueAt: true,
          createdAt: true,
        },
      },
      receipts: {
        orderBy: { issuedAt: "desc" },
        take: 20,
        select: {
          id: true,
          receiptNumber: true,
          amountNis: true,
          issuedAt: true,
          paymentAllocations: {
            select: { sessionId: true },
          },
        },
      },
      conceptLinks: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          label: true,
          href: true,
          updatedAt: true,
        },
      },
      guidances: {
        orderBy: [{ updatedAt: "desc" }],
        take: 50,
        include: {
          sessions: {
            include: {
              session: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!patient) return notFound();

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
      <BackButton fallback={`/patients/${patient.id}`} />
      <section className="app-section">
        <h1 className="text-xl font-semibold">רשת קשרים: {patient.firstName} {patient.lastName}</h1>
      </section>
      <PatientConnectionsGraph data={graphData} variant="full" />
    </main>
  );
}
