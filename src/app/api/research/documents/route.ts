import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";
import { extractResearchMetadata } from "@/lib/research-extract";

function parseCommaList(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  const externalUrl = String(formData.get("externalUrl") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "ARTICLE").trim();
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const sourceCustom = String(formData.get("sourceCustom") ?? "").trim();

  if ((!(file instanceof File) || file.size === 0) && !externalUrl) {
    return NextResponse.json({ error: "Missing file or external url" }, { status: 400 });
  }

  const source = String(formData.get("source") ?? "").trim();
  const patientId = String(formData.get("patientId") ?? "").trim();
  const workspaceNotes = String(formData.get("workspaceNotes") ?? "").trim();
  const kind =
    kindRaw === "ARTICLE" ||
    kindRaw === "BOOK" ||
    kindRaw === "VIDEO" ||
    kindRaw === "LECTURE_NOTE" ||
    kindRaw === "OTHER"
      ? kindRaw
      : "ARTICLE";

  let extracted: { title: string; authors: string[]; topics: string[]; ocrText: string } = {
    title: "",
    authors: [],
    topics: [],
    ocrText: "",
  };
  if (file instanceof File && file.size > 0) {
    try {
      extracted = await extractResearchMetadata(file);
    } catch {
      // Keep save flow resilient even if extraction fails on a specific file.
      extracted = { title: "", authors: [], topics: [], ocrText: "" };
    }
  }
  const title = String(formData.get("title") ?? "").trim() || extracted.title || (file instanceof File ? file.name : externalUrl);
  const authors = parseCommaList(String(formData.get("authors") ?? "")).length
    ? parseCommaList(String(formData.get("authors") ?? ""))
    : extracted.authors;
  const topics = parseCommaList(String(formData.get("topics") ?? "")).length
    ? parseCommaList(String(formData.get("topics") ?? ""))
    : extracted.topics;

  let relPath = "";
  if (file instanceof File && file.size > 0) {
    const bytes = await file.arrayBuffer();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${Date.now()}-${safeName}`;
    relPath = `/uploads/research/${filename}`;
    const absDir = path.join(process.cwd(), "public", "uploads", "research");
    await mkdir(absDir, { recursive: true });
    await writeFile(path.join(absDir, filename), Buffer.from(bytes));
  }
  if (!relPath && externalUrl) {
    relPath = "";
  }

  const sourceRef =
    sourceId && sourceId !== "__custom__"
      ? { connect: { id: sourceId } }
      : sourceCustom
        ? {
            connectOrCreate: {
              where: { name: sourceCustom },
              create: { name: sourceCustom },
            },
          }
        : undefined;

  const doc = await prisma.researchDocument.create({
    data: {
      kind,
      title,
      source: source || null,
      sourceRef,
      externalUrl: externalUrl || null,
      filePath: relPath || null,
      ocrText: extracted.ocrText || null,
      workspaceNotes: workspaceNotes || null,
      authors: authors.length
        ? {
            create: authors.map((name) => ({
              author: {
                connectOrCreate: {
                  where: { name },
                  create: { name },
                },
              },
            })),
          }
        : undefined,
      topics: topics.length
        ? {
            create: topics.map((name) => ({
              topic: {
                connectOrCreate: {
                  where: { name },
                  create: { name },
                },
              },
            })),
          }
        : undefined,
      links: patientId
        ? {
            create: {
              targetEntityType: ResearchTargetType.PATIENT,
              targetEntityId: patientId,
            },
          }
        : undefined,
    },
  });

  return NextResponse.json({ ok: true, documentId: doc.id });
}
