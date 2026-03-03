import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ResearchTargetType } from "@prisma/client";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

function parseCsv(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `${Date.now()}-${safeName}`;
      const absDir = path.join(process.cwd(), "public", "uploads", "research");
      await mkdir(absDir, { recursive: true });
      const bytes = await file.arrayBuffer();
      await writeFile(path.join(absDir, filename), Buffer.from(bytes));
      filePath = `/uploads/research/${filename}`;
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

    const sourceRef = sourceRaw
      ? {
          connectOrCreate: {
            where: { name: sourceRaw },
            create: { name: sourceRaw },
          },
        }
      : undefined;

    const document = await prisma.researchDocument.create({
      data: {
        owner: { connect: { id: userId } },
        kind,
        title,
        source: sourceRaw || null,
        sourceRef,
        externalUrl: externalUrlRaw || null,
        filePath,
        workspaceNotes: workspaceNotesRaw || null,
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
      select: { id: true },
    });

    return NextResponse.json({ ok: true, documentId: document.id });
  } catch (error) {
    console.error("research-upload-v1 failed", error);
    return NextResponse.json({ error: "שמירת המסמך נכשלה." }, { status: 500 });
  }
}
