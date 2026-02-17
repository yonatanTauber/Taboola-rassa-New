import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const guidance = await prisma.guidance.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    select: {
      id: true,
      attachmentFilePath: true,
    },
  });
  if (!guidance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const ext = extensionFromName(file.name);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Only PDF/DOC/DOCX are supported" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${id}-${Date.now()}-${safeName}`;
  const relPath = `/uploads/guidance/${fileName}`;
  const absDir = path.join(process.cwd(), "public", "uploads", "guidance");
  const absFilePath = path.join(absDir, fileName);

  await mkdir(absDir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(absFilePath, Buffer.from(bytes));

  await prisma.guidance.update({
    where: { id },
    data: {
      attachmentFilePath: relPath,
      attachmentFileName: file.name,
      attachmentMimeType: file.type?.trim() || MIME_BY_EXT[ext] || "application/octet-stream",
    },
  });

  await deleteStoredAttachment(guidance.attachmentFilePath);

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    mimeType: file.type?.trim() || MIME_BY_EXT[ext] || "application/octet-stream",
    filePath: relPath,
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const guidance = await prisma.guidance.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    select: {
      id: true,
      attachmentFilePath: true,
    },
  });
  if (!guidance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.guidance.update({
    where: { id },
    data: {
      attachmentFilePath: null,
      attachmentFileName: null,
      attachmentMimeType: null,
    },
  });

  await deleteStoredAttachment(guidance.attachmentFilePath);

  return NextResponse.json({ ok: true, deleted: true });
}

function extensionFromName(fileName: string) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  return ext || null;
}

async function deleteStoredAttachment(filePath: string | null) {
  if (!filePath) return;
  if (!filePath.startsWith("/uploads/guidance/")) return;
  const fileName = path.basename(filePath);
  const absPath = path.join(process.cwd(), "public", "uploads", "guidance", fileName);
  try {
    await unlink(absPath);
  } catch {
    // Ignore missing files and continue.
  }
}
