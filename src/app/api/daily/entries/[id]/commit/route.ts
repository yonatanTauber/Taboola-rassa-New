import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-server";
import { canUseDailyV1 } from "@/lib/daily-feature";
import { commitDailyEntry } from "@/lib/daily-service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  if (!userId) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (!canUseDailyV1(user?.email)) return NextResponse.json({ error: "הגישה לדף היומי אינה פעילה עבור המשתמש." }, { status: 403 });

  const params = await ctx.params;
  const id = String(params.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "מזהה רשומה חסר." }, { status: 400 });

  const result = await commitDailyEntry(userId, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAudit({
    action: "COMMIT_DAILY_ENTRY",
    userId,
    resourceType: String(result.targetEntityType).toLowerCase(),
    resourceId: result.targetEntityId,
    req,
  });

  return NextResponse.json({ ok: true, targetEntityType: result.targetEntityType, targetEntityId: result.targetEntityId });
}
