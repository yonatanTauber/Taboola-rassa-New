import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ResearchTargetType } from "@prisma/client";

export async function POST(req: Request) {
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const patientId = String(body.patientId ?? "").trim();
  const relatedEntityType = String(body.relatedEntityType ?? "").trim();
  const relatedEntityId = String(body.relatedEntityId ?? "").trim();

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const note = await prisma.researchNote.create({
    data: {
      title,
      markdown: content,
      links:
        patientId || (relatedEntityType && relatedEntityId)
          ? {
              create: patientId
                ? {
                    targetEntityType: ResearchTargetType.PATIENT,
                    targetEntityId: patientId,
                  }
                : {
                    targetEntityType: normalizeTargetType(relatedEntityType),
                    targetEntityId: relatedEntityId,
                  },
            }
          : undefined,
    },
  });

  return NextResponse.json({ ok: true, noteId: note.id });
}


function normalizeTargetType(value: string | null) {
  if (!value) return ResearchTargetType.OTHER;
  if (value === "PATIENT") return ResearchTargetType.PATIENT;
  if (value === "RESEARCH_DOCUMENT") return ResearchTargetType.RESEARCH_DOCUMENT;
  return ResearchTargetType.OTHER;
}
