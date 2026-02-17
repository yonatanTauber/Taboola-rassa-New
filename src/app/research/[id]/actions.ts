"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";

export async function addDocumentAnnotation(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const tagsJson = String(formData.get("tags") ?? "[]");

  if (!documentId || !title) return;

  let tags: Array<{ entityType: string; entityId: string; label?: string }> = [];
  try {
    tags = JSON.parse(tagsJson);
  } catch {
    tags = [];
  }

  const created = await prisma.researchNote.create({
    data: { title, markdown: note },
  });

  await createLinksForNote(created.id, documentId, tags);

  revalidatePath(`/research/${documentId}`);
  revalidatePath("/research");
  revalidatePatientPages(tags);
}

export async function updateDocumentAnnotation(formData: FormData) {
  const annotationId = String(formData.get("annotationId") ?? "").trim();
  const documentId = String(formData.get("documentId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const tagsJson = String(formData.get("tags") ?? "[]");

  if (!annotationId || !documentId || !title) return;

  let tags: Array<{ entityType: string; entityId: string; label?: string }> = [];
  try {
    tags = JSON.parse(tagsJson);
  } catch {
    tags = [];
  }

  // Update note content
  await prisma.researchNote.update({
    where: { id: annotationId },
    data: { title, markdown: note },
  });

  // Delete existing links and recreate
  await prisma.researchLink.deleteMany({
    where: { researchNoteId: annotationId },
  });

  await createLinksForNote(annotationId, documentId, tags);

  revalidatePath(`/research/${documentId}`);
  revalidatePath("/research");
  revalidatePatientPages(tags);
}

// ── Helpers ────────────────────────────────────────────

async function createLinksForNote(
  noteId: string,
  documentId: string,
  tags: Array<{ entityType: string; entityId: string; label?: string }>,
) {
  const linkPromises = [
    prisma.researchLink.create({
      data: {
        researchNoteId: noteId,
        targetEntityType: ResearchTargetType.RESEARCH_DOCUMENT,
        targetEntityId: documentId,
      },
    }),
  ];

  for (const tag of tags) {
    const targetType = mapToResearchTargetType(tag.entityType);
    if (!targetType) continue;
    if (targetType === ResearchTargetType.RESEARCH_DOCUMENT && tag.entityId === documentId) continue;

    linkPromises.push(
      prisma.researchLink.create({
        data: {
          researchNoteId: noteId,
          targetEntityType: targetType,
          targetEntityId: tag.entityId,
          targetEntityAlias: tag.label || null,
        },
      }),
    );
  }

  await Promise.all(linkPromises);
}

function revalidatePatientPages(tags: Array<{ entityType: string; entityId: string }>) {
  for (const tag of tags) {
    if (tag.entityType === "patient") {
      revalidatePath(`/patients/${tag.entityId}`);
    }
  }
}

function mapToResearchTargetType(type: string): ResearchTargetType | null {
  switch (type) {
    case "patient":
      return ResearchTargetType.PATIENT;
    case "session":
      return ResearchTargetType.SESSION;
    case "task":
      return ResearchTargetType.TASK;
    case "receipt":
      return ResearchTargetType.RECEIPT;
    case "inquiry":
      return ResearchTargetType.INQUIRY;
    case "research-document":
      return ResearchTargetType.RESEARCH_DOCUMENT;
    case "research-note":
      return ResearchTargetType.RESEARCH_NOTE;
    case "topic":
      return ResearchTargetType.OTHER;
    default:
      return null;
  }
}
