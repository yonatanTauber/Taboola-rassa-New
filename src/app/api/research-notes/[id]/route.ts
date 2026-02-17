import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { resolveResearchNoteOwnership } from "@/lib/research-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { title?: string; markdown?: string };

  const ownership = await resolveResearchNoteOwnership(userId, id);
  if (!ownership.exists || !ownership.owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  if (!title) return NextResponse.json({ error: "חובה להזין כותרת" }, { status: 400 });

  const updated = await prisma.researchNote.update({
    where: { id },
    data: { title, markdown },
  });
  return NextResponse.json({ ok: true, note: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const ownership = await resolveResearchNoteOwnership(userId, id);
  if (!ownership.exists || !ownership.owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.researchNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
