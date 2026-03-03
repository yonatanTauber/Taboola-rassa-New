import { DailyEntryStatus, DailyEntryType } from "@prisma/client";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-server";
import { canUseDailyV1 } from "@/lib/daily-feature";
import { updateDailyEntry } from "@/lib/daily-service";

function normalizeType(raw: unknown) {
  if (raw === DailyEntryType.SESSION) return DailyEntryType.SESSION;
  if (raw === DailyEntryType.TASK) return DailyEntryType.TASK;
  if (raw === DailyEntryType.GUIDANCE) return DailyEntryType.GUIDANCE;
  if (raw === DailyEntryType.UNKNOWN) return DailyEntryType.UNKNOWN;
  return undefined;
}

function normalizeStatus(raw: unknown) {
  if (raw === DailyEntryStatus.DRAFT) return DailyEntryStatus.DRAFT;
  if (raw === DailyEntryStatus.READY) return DailyEntryStatus.READY;
  if (raw === DailyEntryStatus.SAVED) return DailyEntryStatus.SAVED;
  if (raw === DailyEntryStatus.SAVE_FAILED) return DailyEntryStatus.SAVE_FAILED;
  return undefined;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  if (!userId) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (!canUseDailyV1(user?.email)) return NextResponse.json({ error: "הגישה לדף היומי אינה פעילה עבור המשתמש." }, { status: 403 });

  const params = await ctx.params;
  const id = String(params.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "מזהה רשומה חסר." }, { status: 400 });

  const body = (await req.json()) as {
    parsedType?: unknown;
    status?: unknown;
    matchedPatientId?: unknown;
    matchedPatientName?: unknown;
    entryDate?: unknown;
    entryTime?: unknown;
    content?: unknown;
    title?: unknown;
    rawText?: unknown;
  };

  const updated = await updateDailyEntry(userId, id, {
    parsedType: normalizeType(body.parsedType),
    status: normalizeStatus(body.status),
    matchedPatientId: body.matchedPatientId === undefined ? undefined : (String(body.matchedPatientId ?? "").trim() || null),
    matchedPatientName: body.matchedPatientName === undefined ? undefined : (String(body.matchedPatientName ?? "").trim() || null),
    entryDate: body.entryDate === undefined ? undefined : String(body.entryDate ?? "").trim(),
    entryTime: body.entryTime === undefined ? undefined : (String(body.entryTime ?? "").trim() || null),
    content: body.content === undefined ? undefined : String(body.content ?? ""),
    title: body.title === undefined ? undefined : (String(body.title ?? "").trim() || null),
    rawText: body.rawText === undefined ? undefined : String(body.rawText ?? ""),
  });

  if (!updated) return NextResponse.json({ error: "רשומה יומית לא נמצאה." }, { status: 404 });

  await logAudit({
    action: "EDIT_DAILY_ENTRY",
    userId,
    resourceType: "daily-entry",
    resourceId: updated.id,
    req,
  });

  return NextResponse.json({ ok: true, entryId: updated.id, updatedAt: updated.updatedAt });
}
