import { ResearchWorkspace } from "@/components/research/ResearchWorkspace";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireCurrentUserId();
  if (!userId) return null;

  const params = (await searchParams) ?? {};
  const initialFilters = {
    q: typeof params.q === "string" ? params.q : "",
    kind: typeof params.kind === "string" ? params.kind : "ALL",
    topic: typeof params.topic === "string" ? params.topic : "ALL",
    author: typeof params.author === "string" ? params.author : "ALL",
  };

  const patients = await prisma.patient.findMany({
    where: { ownerUserId: userId, archivedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 400,
  });
  const ownedPatientIds = patients.map((patient) => patient.id);

  const docs =
    ownedPatientIds.length > 0
      ? await prisma.researchDocument.findMany({
          where: {
            links: {
              some: {
                targetEntityType: ResearchTargetType.PATIENT,
                targetEntityId: { in: ownedPatientIds },
              },
            },
          },
          include: {
            authors: { include: { author: true } },
            topics: { include: { topic: true } },
            links: true,
            sourceRef: true,
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const authorMap = new Map<string, { id: string; name: string }>();
  const topicMap = new Map<string, { id: string; name: string }>();
  const sourceMap = new Map<string, { id: string; name: string }>();

  for (const doc of docs) {
    for (const item of doc.authors) {
      authorMap.set(item.author.id, { id: item.author.id, name: item.author.name });
    }
    for (const item of doc.topics) {
      topicMap.set(item.topic.id, { id: item.topic.id, name: item.topic.name });
    }
    if (doc.sourceId && doc.sourceRef?.name) {
      sourceMap.set(doc.sourceId, { id: doc.sourceId, name: doc.sourceRef.name });
    }
  }

  return (
    <ResearchWorkspace
      docs={docs.map((doc) => ({
        id: doc.id,
        kind: doc.kind,
        title: doc.title,
        source: doc.source,
        externalUrl: doc.externalUrl,
        filePath: doc.filePath,
        workspaceNotes: doc.workspaceNotes,
        createdAt: doc.createdAt.toISOString(),
        authors: doc.authors.map((item) => item.author.name),
        topics: doc.topics.map((item) => item.topic.name),
        linkedPatients: doc.links
          .filter((link) => link.targetEntityType === ResearchTargetType.PATIENT)
          .map((link) => patientMap.get(link.targetEntityId))
          .filter(Boolean)
          .map((patient) => ({
            id: patient!.id,
            name: formatPatientName(patient!.firstName, patient!.lastName),
          })),
      }))}
      patients={patients.map((p) => ({ id: p.id, name: formatPatientName(p.firstName, p.lastName) }))}
      authorsCatalog={[...authorMap.values()].sort((a, b) => a.name.localeCompare(b.name, "he"))}
      topicsCatalog={[...topicMap.values()].sort((a, b) => a.name.localeCompare(b.name, "he"))}
      sourcesCatalog={[...sourceMap.values()].sort((a, b) => a.name.localeCompare(b.name, "he"))}
      initialFilters={initialFilters}
    />
  );
}
