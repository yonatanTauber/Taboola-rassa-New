import { NextResponse } from "next/server";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify session ownership
  const session = await prisma.session.findFirst({
    where: { id, patient: { ownerUserId: userId } },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestedNames: [] });

  try {
    const body = (await req.json()) as { markdown?: string; existingFigureNames?: string[] };
    const markdown = (body.markdown ?? "").slice(0, 4000);
    const existing = body.existingFigureNames ?? [];

    if (!markdown.trim()) return NextResponse.json({ suggestedNames: [] });

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `You are analyzing a therapy session note written in Hebrew.
Extract the names of all people mentioned (family members, partners, friends, colleagues, etc.).
Do NOT include the therapist or the patient themselves.
Return ONLY a JSON object in this exact format: {"names": ["name1", "name2"]}
If no person names are found, return: {"names": []}

Session note:
${markdown}`,
          },
        ],
      }),
    });

    if (!apiRes.ok) return NextResponse.json({ suggestedNames: [] });

    const data = (await apiRes.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const textBlock = data.content.find((c) => c.type === "text");
    if (!textBlock) return NextResponse.json({ suggestedNames: [] });

    // Extract JSON from response (may have extra text)
    const match = textBlock.text.match(/\{[\s\S]*"names"[\s\S]*\}/);
    if (!match) return NextResponse.json({ suggestedNames: [] });

    const parsed = JSON.parse(match[0]) as { names: string[] };
    const detected = Array.isArray(parsed.names) ? parsed.names : [];

    // Filter out names already known as figures
    const existingLower = existing.map((n) => n.toLowerCase());
    const suggestedNames = detected.filter(
      (name) => name.trim().length > 1 && !existingLower.includes(name.toLowerCase())
    );

    return NextResponse.json({ suggestedNames });
  } catch {
    return NextResponse.json({ suggestedNames: [] });
  }
}
