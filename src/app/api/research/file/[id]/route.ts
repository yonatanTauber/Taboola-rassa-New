import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ResearchTargetType } from "@prisma/client";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { listOwnedPatientIds } from "@/lib/research-access";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  ogg: "video/ogg",
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ownedPatientIds = await listOwnedPatientIds(userId);
  if (ownedPatientIds.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await prisma.researchDocument.findFirst({
    where: {
      id,
      links: {
        some: {
          targetEntityType: ResearchTargetType.PATIENT,
          targetEntityId: { in: ownedPatientIds },
        },
      },
    },
    select: { filePath: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.filePath) return NextResponse.json({ error: "No file" }, { status: 404 });
  if (!doc.filePath.startsWith("/") || doc.filePath.startsWith("//") || doc.filePath.includes("..")) {
    return NextResponse.json({ error: "Not a local file" }, { status: 400 });
  }

  const rel = doc.filePath.replace(/^\/+/, "");
  const abs = path.join(process.cwd(), "public", rel);
  let bytes: Buffer;
  try {
    bytes = await readFile(abs);
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
  const ext = path.extname(abs).replace(".", "").toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const filename = path.basename(abs);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename=\"${filename}\"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=60",
    },
  });
}
