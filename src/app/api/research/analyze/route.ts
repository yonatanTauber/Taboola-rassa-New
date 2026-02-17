import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { extractResearchMetadata } from "@/lib/research-extract";

export async function POST(req: Request) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  try {
    const metadata = await extractResearchMetadata(file);
    return NextResponse.json({ ok: true, metadata });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      metadata: {
        title: file.name.replace(/\.[^.]+$/, ""),
        authors: [],
        topics: [],
        ocrText: "",
      },
      warning: error instanceof Error ? error.message : "metadata extraction failed",
    });
  }
}
