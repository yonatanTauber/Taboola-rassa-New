import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { canUseDailyV1 } from "@/lib/daily-feature";
import { parseDailyText } from "@/lib/daily-service";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (!canUseDailyV1(user.email)) return NextResponse.json({ error: "הגישה לדף היומי אינה פעילה עבור המשתמש." }, { status: 403 });

  try {
    const body = (await req.json()) as { text?: unknown };
    const text = String(body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "טקסט ריק." }, { status: 400 });
    }

    const parsed = await parseDailyText(user.id, text);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "ניתוח הטקסט נכשל." }, { status: 500 });
  }
}
