import { NextResponse } from "next/server";
import { ResearchTargetType } from "@prisma/client";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { isResearchTargetOwnedByUser, normalizeResearchTargetType } from "@/lib/research-access";

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const patientId = String(body.patientId ?? "").trim();
  const relatedEntityType = String(body.relatedEntityType ?? "").trim();
  const relatedEntityId = String(body.relatedEntityId ?? "").trim();

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const link =
    patientId
      ? {
          targetEntityType: ResearchTargetType.PATIENT,
          targetEntityId: patientId,
        }
      : relatedEntityType && relatedEntityId
        ? {
            targetEntityType: normalizeResearchTargetType(relatedEntityType),
            targetEntityId: relatedEntityId,
          }
        : null;

  if (!link || link.targetEntityType === ResearchTargetType.OTHER) {
    return NextResponse.json({ error: "יש לקשר את הפתק לישות תקינה." }, { status: 400 });
  }

  const canLink = await isResearchTargetOwnedByUser(userId, link.targetEntityType, link.targetEntityId);
  if (!canLink) {
    return NextResponse.json({ error: "Related entity not found" }, { status: 404 });
  }

  const note = await prisma.researchNote.create({
    data: {
      title,
      markdown: content,
      links: {
        create: link,
      },
    },
  });

  return NextResponse.json({ ok: true, noteId: note.id });
}
