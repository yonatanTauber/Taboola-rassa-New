import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ResearchTargetType } from "@prisma/client";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

function parseCsv(raw: string) {
  return Array.from(new Set(raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)));
}

function normalizeKind(kindRaw: string) {
  if (kindRaw === "ARTICLE" || kindRaw === "BOOK" || kindRaw === "VIDEO" || kindRaw === "LECTURE_NOTE" || kindRaw === "OTHER") {
    return kindRaw;
  }
  return "ARTICLE";
}

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const titleRaw = String(formData.get("title") ?? "").trim();
    const sourceRaw = String(formData.get("source") ?? "").trim();
    const externalUrlRaw = String(formData.get("externalUrl") ?? "").trim();
    const workspaceNotesRaw = String(formData.get("workspaceNotes") ?? "").trim();
    const kind = normalizeKind(String(formData.get("kind") ?? "ARTICLE").trim());
    const patientIdRaw = String(formData.get("patientId") ?? "").trim();
    const authors = parseCsv(String(formData.get("authors") ?? ""));
    const topics = parseCsv(String(formData.get("topics") ?? ""));

    let filePath: string | null = null;
    if (file instanceof File && file.size > 0) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filename = `${Date.now()}-${safeName}`;
        const absDir = path.join(process.cwd(), "public", "uploads", "research");
        await mkdir(absDir, { recursive: true });
        const bytes = await file.arrayBuffer();
        await writeFile(path.join(absDir, filename), Buffer.from(bytes));
        filePath = `/uploads/research/${filename}`;
      } catch (fsErr) {
        console.warn("research file write skipped:", fsErr instanceof Error ? fsErr.message : fsErr);
      }
    }

    let patientId: string | null = null;
    if (patientIdRaw) {
      const ownedPatient = await prisma.patient.findFirst({
        where: {
          id: patientIdRaw,
          ownerUserId: userId,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (ownedPatient) {
        patientId = ownedPatient.id;
      }
    }

    const title =
      titleRaw ||
      (file instanceof File && file.size > 0 ? file.name : "") ||
      externalUrlRaw ||
      "מקור חדש";

    const sourceRecord = sourceRaw
      ? await prisma.researchSource.upsert({
          where: { name: sourceRaw },
          update: {},
          create: { name: sourceRaw },
          select: { id: true },
        })
      : null;

    const document = await prisma.researchDocument.create({
      data: {
        owner: { connect: { id: userId } },
        kind,
        title,
        source: sourceRaw || null,
        sourceRef: sourceRecord ? { connect: { id: sourceRecord.id } } : undefined,
        externalUrl: externalUrlRaw || null,
        filePath,
        workspaceNotes: workspaceNotesRaw || null,
      },
      select: { id: true },
    });

    if (authors.length) {
      const authorIds: string[] = [];
      for (const name of authors) {
        const author = await prisma.author.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        });
        authorIds.push(author.id);
      }
      await prisma.researchDocumentAuthor.createMany({
        data: authorIds.map((authorId) => ({ documentId: document.id, authorId })),
      });
    }

    if (topics.length) {
      const topicIds: string[] = [];
      for (const name of topics) {
        const topic = await prisma.topic.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        });
        topicIds.push(topic.id);
      }
      await prisma.researchDocumentTopic.createMany({
        data: topicIds.map((topicId) => ({ documentId: document.id, topicId })),
      });
    }

    if (patientId) {
      await prisma.researchLink.create({
        data: {
          researchDocumentId: document.id,
          targetEntityType: ResearchTargetType.PATIENT,
          targetEntityId: patientId,
        },
      });
    }

    return NextResponse.json({ ok: true, documentId: document.id });
  } catch (error) {
    console.error("research-upload-v1 failed", error);
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: `שמירת המסמך נכשלה. ${message}` }, { status: 500 });
  }
}
