import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { isResearchDocumentOwnedByUser } from "@/lib/research-access";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const canAccess = await isResearchDocumentOwnedByUser(userId, id);
    if (!canAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const workspaceNotes = String(body.workspaceNotes ?? "");

    const updated = await prisma.researchDocument.update({
      where: { id },
      data: { workspaceNotes },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, documentId: updated.id, updatedAt: updated.updatedAt });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update research document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}
