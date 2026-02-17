import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { AnnotationsSidebar } from "@/components/research/AnnotationsSidebar";
import { WorkspaceNotesAutosave } from "@/components/research/WorkspaceNotesAutosave";
import { requireCurrentUserId } from "@/lib/auth-server";
import { formatPatientName } from "@/lib/patient-name";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";

export default async function ResearchDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return notFound();
  const { id } = await params;

  const patients = await prisma.patient.findMany({
    where: { ownerUserId: userId, archivedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const ownedPatientIds = patients.map((patient) => patient.id);
  if (ownedPatientIds.length === 0) return notFound();

  const [document, annotations, topics, otherDocuments] = await Promise.all([
    prisma.researchDocument.findFirst({
      where: {
        id,
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
      },
    }),
    prisma.researchNote.findMany({
      where: {
        links: {
          some: {
            targetEntityType: ResearchTargetType.RESEARCH_DOCUMENT,
            targetEntityId: id,
          },
        },
        AND: {
          links: {
            some: {
              targetEntityType: ResearchTargetType.PATIENT,
              targetEntityId: { in: ownedPatientIds },
            },
          },
        },
      },
      include: { links: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.topic.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.researchDocument.findMany({
      where: {
        id: { not: id },
        links: {
          some: {
            targetEntityType: ResearchTargetType.PATIENT,
            targetEntityId: { in: ownedPatientIds },
          },
        },
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  if (!document) return notFound();

  // Resolve entity aliases for annotation links
  const allAnnotationLinks = annotations.flatMap((a) => a.links);
  const patientIds = new Set(
    allAnnotationLinks.filter((l) => l.targetEntityType === "PATIENT").map((l) => l.targetEntityId),
  );
  const docIds = new Set(
    allAnnotationLinks
      .filter((l) => l.targetEntityType === "RESEARCH_DOCUMENT")
      .map((l) => l.targetEntityId),
  );

  const [linkedPatients, linkedDocs] = await Promise.all([
    patientIds.size > 0
      ? prisma.patient.findMany({
          where: { id: { in: [...patientIds] }, ownerUserId: userId },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    docIds.size > 0
      ? prisma.researchDocument.findMany({
          where: {
            id: { in: [...docIds] },
            links: {
              some: {
                targetEntityType: ResearchTargetType.PATIENT,
                targetEntityId: { in: ownedPatientIds },
              },
            },
          },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  const aliasMap = new Map<string, string>();
  for (const p of linkedPatients) aliasMap.set(p.id, formatPatientName(p.firstName, p.lastName));
  for (const d of linkedDocs) aliasMap.set(d.id, d.title);

  const serializedAnnotations = annotations.map((a) => ({
    id: a.id,
    title: a.title,
    markdown: a.markdown,
    links: a.links.map((lnk) => ({
      id: lnk.id,
      targetEntityType: lnk.targetEntityType,
      targetEntityId: lnk.targetEntityId,
      targetEntityAlias: lnk.targetEntityAlias ?? aliasMap.get(lnk.targetEntityId) ?? null,
    })),
  }));

  const categories = {
    patients: patients.map((p) => ({ id: p.id, label: formatPatientName(p.firstName, p.lastName) })),
    topics: topics.map((t) => ({ id: t.id, label: t.name })),
    documents: otherDocuments.map((d) => ({ id: d.id, label: d.title })),
  };

  const localFileUrl =
    document.filePath && document.filePath.startsWith("/") && !document.filePath.startsWith("//")
      ? `/api/research/file/${document.id}`
      : "";
  const viewerUrl = document.externalUrl || localFileUrl || document.filePath || "";
  const ext = extensionFromPath(document.filePath || document.externalUrl || viewerUrl);
  const isVideoFile = ["mp4", "webm", "ogg", "mov", "m4v"].includes(ext);
  const isPdf = ext === "pdf";
  const isText = ["txt", "md"].includes(ext);
  const embedUrl = toEmbedUrl(viewerUrl);

  return (
    <main className="space-y-4">
      <BackButton fallback="/research" />

      {/* Document metadata header */}
      <section className="app-section">
        <h1 className="text-xl font-semibold">{document.title}</h1>
        <p className="text-sm text-muted">סוג פריט: {kindLabel(document.kind)}</p>
        <p className="text-sm text-muted">מקור: {document.source ?? "לא צוין"}</p>
        <p className="text-xs text-muted">
          כותבים: {document.authors.length ? document.authors.map((x) => x.author.name).join(", ") : "לא צוינו"}
        </p>
        <p className="text-xs text-muted">
          נושאים: {document.topics.length ? document.topics.map((x) => x.topic.name).join(", ") : "ללא נושאים"}
        </p>
      </section>

      {/* Main content area */}
      {document.kind === "VIDEO" ? (
        <VideoLayout
          document={document}
          embedUrl={embedUrl}
          isVideoFile={isVideoFile}
          viewerUrl={viewerUrl}
          serializedAnnotations={serializedAnnotations}
          categories={categories}
        />
      ) : (
        <DocumentLayout
          document={document}
          isPdf={isPdf}
          isText={isText}
          viewerUrl={viewerUrl}
          serializedAnnotations={serializedAnnotations}
          categories={categories}
        />
      )}
    </main>
  );
}

// ── Layout Components ──────────────────────────────────

type LayoutProps = {
  document: { id: string; title: string; ocrText: string | null; workspaceNotes: string | null };
  serializedAnnotations: Array<{
    id: string;
    title: string;
    markdown: string;
    links: Array<{ id: string; targetEntityType: string; targetEntityId: string; targetEntityAlias: string | null }>;
  }>;
  categories: {
    patients: Array<{ id: string; label: string }>;
    topics: Array<{ id: string; label: string }>;
    documents: Array<{ id: string; label: string }>;
  };
};

function VideoLayout({
  document,
  embedUrl,
  isVideoFile,
  viewerUrl,
  serializedAnnotations,
  categories,
}: LayoutProps & { embedUrl: string | null; isVideoFile: boolean; viewerUrl: string }) {
  return (
    <section className="space-y-4">
      <div className="app-section">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={document.title}
            className="h-[68vh] w-full rounded-lg border border-black/10"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isVideoFile ? (
          <video controls className="h-[68vh] w-full rounded-lg border border-black/10" src={viewerUrl} />
        ) : (
          <div className="rounded-lg border border-black/10 p-3 text-sm">
            <Link href={viewerUrl} target="_blank" className="text-accent hover:underline">
              פתח וידאו
            </Link>
          </div>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
        <WorkspaceNotesAutosave documentId={document.id} initialValue={document.workspaceNotes ?? ""} />
        <AnnotationsSidebar
          documentId={document.id}
          annotations={serializedAnnotations}
          categories={categories}
        />
      </div>
    </section>
  );
}

function DocumentLayout({
  document,
  isPdf,
  isText,
  viewerUrl,
  serializedAnnotations,
  categories,
}: LayoutProps & { isPdf: boolean; isText: boolean; viewerUrl: string }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
      {/* Left column: viewer + free-form notes below */}
      <div className="space-y-4">
        <div className="app-section">
          {isPdf ? (
            <div className="flex flex-col">
              <iframe
                src={viewerUrl}
                title={document.title}
                className="h-[68vh] w-full rounded-lg border border-black/10"
              />
              <a
                href={viewerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 self-start text-xs text-accent hover:underline"
              >
                פתח PDF בחלון חדש ↗
              </a>
            </div>
          ) : isText ? (
            <pre className="h-[68vh] overflow-auto whitespace-pre-wrap rounded-lg border border-black/10 p-3 text-sm">
              {document.ocrText || "אין תוכן טקסט להצגה."}
            </pre>
          ) : (
            <div className="rounded-lg border border-black/10 p-3 text-sm text-muted">
              סוג קובץ זה לא נתמך עדיין להצגה מלאה בתוך המערכת. מומלץ להעלות PDF/TXT.
            </div>
          )}
        </div>
        <WorkspaceNotesAutosave documentId={document.id} initialValue={document.workspaceNotes ?? ""} />
      </div>

      {/* Right column: annotations sidebar */}
      <AnnotationsSidebar
        documentId={document.id}
        annotations={serializedAnnotations}
        categories={categories}
      />
    </section>
  );
}

// ── Utility Functions ──────────────────────────────────

function kindLabel(kind: string) {
  if (kind === "ARTICLE") return "מאמר";
  if (kind === "BOOK") return "ספר";
  if (kind === "VIDEO") return "וידאו";
  if (kind === "LECTURE_NOTE") return "הרצאה/סיכום";
  return "אחר";
}

function toEmbedUrl(url: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const vid = parsed.pathname.replace("/", "");
      if (vid) return `https://www.youtube.com/embed/${vid}`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const vid = parsed.pathname.split("/").filter(Boolean)[0];
      if (vid) return `https://player.vimeo.com/video/${vid}`;
    }
  } catch {
    return null;
  }
  return null;
}

function extensionFromPath(input: string) {
  if (!input) return "";
  try {
    const url = new URL(input, "http://local");
    const pathname = url.pathname || "";
    const last = pathname.split(".").pop() || "";
    return last.toLowerCase();
  } catch {
    const last = input.split(".").pop() || "";
    return last.toLowerCase();
  }
}
