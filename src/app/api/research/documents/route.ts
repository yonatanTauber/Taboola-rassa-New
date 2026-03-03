import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";

function parseCommaList(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const externalUrl = String(formData.get("externalUrl") ?? "").trim();
    const kindRaw = String(formData.get("kind") ?? "ARTICLE").trim();
    const sourceIdRaw = String(formData.get("sourceId") ?? "").trim();
    const sourceCustom = String(formData.get("sourceCustom") ?? "").trim();
    const source = String(formData.get("source") ?? "").trim();
    const patientIdRaw = String(formData.get("patientId") ?? "").trim();
    const workspaceNotes = String(formData.get("workspaceNotes") ?? "").trim();

    const kind =
      kindRaw === "ARTICLE" ||
      kindRaw === "BOOK" ||
      kindRaw === "VIDEO" ||
      kindRaw === "LECTURE_NOTE" ||
      kindRaw === "OTHER"
        ? kindRaw
        : "ARTICLE";

    // Validate patient ownership
    let patientId: string | null = null;
    if (patientIdRaw) {
      const ownedPatient = await prisma.patient.findFirst({
        where: { id: patientIdRaw, ownerUserId: userId, archivedAt: null },
        select: { id: true },
      });
      if (ownedPatient) patientId = ownedPatient.id;
    }

    // Handle file upload
    let filePath: string | null = null;
    if (file instanceof File && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `${Date.now()}-${safeName}`;
      const absDir = path.join(process.cwd(), "public", "uploads", "research");
      await mkdir(absDir, { recursive: true });
      await writeFile(path.join(absDir, filename), Buffer.from(bytes));
      filePath = `/uploads/research/${filename}`;
    }

    const title =
      String(formData.get("title") ?? "").trim() ||
      (file instanceof File && file.size > 0 ? file.name : "") ||
      externalUrl ||
      "מקור חדש";

    const authors = parseCommaList(String(formData.get("authors") ?? ""));
    const topics = parseCommaList(String(formData.get("topics") ?? ""));

    // Upsert source record
    let sourceRefId: string | null = null;
    const sourceNameForRef = source || sourceCustom;
    if (sourceNameForRef) {
      const sr = await prisma.researchSource.upsert({
        where: { name: sourceNameForRef },
        update: {},
        create: { name: sourceNameForRef },
        select: { id: true },
      });
      sourceRefId = sr.id;
    } else if (sourceIdRaw && sourceIdRaw !== "__custom__") {
      sourceRefId = sourceIdRaw;
    }

    // Create document (no nested authors/topics/links)
    const doc = await prisma.researchDocument.create({
      data: {
        owner: { connect: { id: userId } },
        kind,
        title,
        source: source || null,
        sourceRef: sourceRefId ? { connect: { id: sourceRefId } } : undefined,
        externalUrl: externalUrl || null,
        filePath,
        workspaceNotes: workspaceNotes || null,
      },
      select: { id: true },
    });

    // Add authors
    if (authors.length) {
      const authorIds: string[] = [];
      for (const name of authors) {
        const a = await prisma.author.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        });
        authorIds.push(a.id);
      }
      await prisma.researchDocumentAuthor.createMany({
        data: authorIds.map((authorId) => ({ documentId: doc.id, authorId })),
      });
    }

    // Add topics
    if (topics.length) {
      const topicIds: string[] = [];
      for (const name of topics) {
        const t = await prisma.topic.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        });
        topicIds.push(t.id);
      }
      await prisma.researchDocumentTopic.createMany({
        data: topicIds.map((topicId) => ({ documentId: doc.id, topicId })),
      });
    }

    // Link to patient
    if (patientId) {
      await prisma.researchLink.create({
        data: {
          researchDocumentId: doc.id,
          targetEntityType: ResearchTargetType.PATIENT,
          targetEntityId: patientId,
        },
      });
    }

    return NextResponse.json({ ok: true, documentId: doc.id });
  } catch (error) {
    console.error("research document save failed", error);
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: `שמירת המסמך נכשלה. ${message}` }, { status: 500 });
  }
}
