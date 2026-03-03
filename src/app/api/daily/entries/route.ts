import { DailyEntryStatus, DailyEntryType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-server";
import { canUseDailyV1 } from "@/lib/daily-feature";
import { createDailyEntry, listDailyEntries } from "@/lib/daily-service";

function normalizeStatus(raw: unknown) {
  if (raw === DailyEntryStatus.DRAFT) return DailyEntryStatus.DRAFT;
  if (raw === DailyEntryStatus.READY) return DailyEntryStatus.READY;
  if (raw === DailyEntryStatus.SAVED) return DailyEntryStatus.SAVED;
  if (raw === DailyEntryStatus.SAVE_FAILED) return DailyEntryStatus.SAVE_FAILED;
  return DailyEntryStatus.READY;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (!canUseDailyV1(user.email)) return NextResponse.json({ error: "הגישה לדף היומי אינה פעילה עבור המשתמש." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 50);
  const entries = await listDailyEntries(user.id, Number.isFinite(limit) ? Math.min(200, Math.max(1, limit)) : 50);
  return NextResponse.json({ ok: true, entries });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (!canUseDailyV1(user.email)) return NextResponse.json({ error: "הגישה לדף היומי אינה פעילה עבור המשתמש." }, { status: 403 });

  const body = (await req.json()) as {
    rawText?: unknown;
    parsedType?: unknown;
    status?: unknown;
    matchedPatientId?: unknown;
    matchedPatientName?: unknown;
    entryDate?: unknown;
    entryTime?: unknown;
    content?: unknown;
    title?: unknown;
    parserProvider?: unknown;
    parserConfidence?: unknown;
    parseMetaJson?: unknown;
  };

  const rawText = String(body.rawText ?? "").trim();
  const content = String(body.content ?? "").trim();
  const entryDate = String(body.entryDate ?? "").trim();

  if (!rawText || !content || !entryDate) {
    return NextResponse.json({ error: "חסר מידע חובה לשמירת יומן יומי." }, { status: 400 });
  }

  const entry = await createDailyEntry(user.id, {
    rawText,
    parsedType: DailyEntryType.SESSION,
    status: normalizeStatus(body.status),
    matchedPatientId: String(body.matchedPatientId ?? "").trim() || null,
    matchedPatientName: String(body.matchedPatientName ?? "").trim() || null,
    entryDate,
    entryTime: String(body.entryTime ?? "").trim() || null,
    content,
    title: String(body.title ?? "").trim() || null,
    parserProvider: String(body.parserProvider ?? "").trim() || null,
    parserConfidence: body.parserConfidence === null || body.parserConfidence === undefined ? null : Number(body.parserConfidence),
    parseMetaJson: (typeof body.parseMetaJson === "object" && body.parseMetaJson !== null)
      ? (body.parseMetaJson as Prisma.InputJsonValue)
      : null,
  });

  await logAudit({
    action: "CREATE_DAILY_ENTRY",
    userId: user.id,
    resourceType: "daily-entry",
    resourceId: entry.id,
    req,
  });

  return NextResponse.json({ ok: true, entryId: entry.id });
}
