import { ResearchWorkspace } from "@/components/research/ResearchWorkspace";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const initialFilters = {
    q: typeof params.q === "string" ? params.q : "",
    kind: typeof params.kind === "string" ? params.kind : "ALL",
    topic: typeof params.topic === "string" ? params.topic : "ALL",
    author: typeof params.author === "string" ? params.author : "ALL",
  };

  const [docs, patients, authors, topics, sources] = await Promise.all([
    prisma.researchDocument.findMany({
      include: {
        authors: { include: { author: true } },
        topics: { include: { topic: true } },
        links: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.patient.findMany({
      where: { archivedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 400,
    }),
    prisma.author.findMany({ orderBy: { name: "asc" }, take: 400 }),
    prisma.topic.findMany({ orderBy: { name: "asc" }, take: 400 }),
    prisma.researchSource.findMany({ orderBy: { name: "asc" }, take: 400 }),
  ]);

  const patientMap = new Map(patients.map((p) => [p.id, p]));

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
      authorsCatalog={authors.map((a) => ({ id: a.id, name: a.name }))}
      topicsCatalog={topics.map((t) => ({ id: t.id, name: t.name }))}
      sourcesCatalog={sources.map((s) => ({ id: s.id, name: s.name }))}
      initialFilters={initialFilters}
    />
  );
}
