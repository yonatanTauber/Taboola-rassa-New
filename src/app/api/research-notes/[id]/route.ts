import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { title?: string; markdown?: string };

  const existing = await prisma.researchNote.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const existing = await prisma.researchNote.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.researchNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
