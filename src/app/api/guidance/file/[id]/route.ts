import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const guidance = await prisma.guidance.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    select: {
      attachmentFilePath: true,
      attachmentFileName: true,
      attachmentMimeType: true,
    },
  });
  if (!guidance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!guidance.attachmentFilePath) return NextResponse.json({ error: "No file" }, { status: 404 });
  if (!guidance.attachmentFilePath.startsWith("/uploads/guidance/")) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  const relPath = guidance.attachmentFilePath.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), "public", relPath);

  let bytes: Buffer;
  try {
    bytes = await readFile(absolutePath);
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const ext = path.extname(absolutePath).replace(".", "").toLowerCase();
  const mimeType = guidance.attachmentMimeType || MIME_BY_EXT[ext] || "application/octet-stream";
  const fileName = guidance.attachmentFileName || path.basename(absolutePath);
  const disposition = ext === "pdf" ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=60",
    },
  });
}
