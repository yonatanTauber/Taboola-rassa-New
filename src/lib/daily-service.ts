import Anthropic from "@anthropic-ai/sdk";
import { DailyEntryStatus, DailyEntryType, DailyTargetEntityType, GuidanceStatus, PatientState, Prisma, SessionStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DailyEntryViewModel, DailyParseResult } from "@/lib/daily-types";

let anthropicClient: Anthropic | null | undefined;

function getAnthropicClient() {
  if (anthropicClient !== undefined) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  anthropicClient = apiKey ? new Anthropic({ apiKey }) : null;
  return anthropicClient;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(raw: string | null | undefined) {
  const value = String(raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIsoDate();
}

function normalizeTime(raw: string | null | undefined) {
  const value = String(raw ?? "").trim();
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

function normalizeType(raw: unknown) {
  if (raw === DailyEntryType.SESSION) return DailyEntryType.SESSION;
  if (raw === DailyEntryType.TASK) return DailyEntryType.TASK;
  if (raw === DailyEntryType.GUIDANCE) return DailyEntryType.GUIDANCE;
  return DailyEntryType.UNKNOWN;
}

function parseDateTime(entryDate: string, entryTime: string | null) {
  const iso = `${entryDate}T${entryTime ?? "00:00"}:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function inferTypeByKeywords(text: string) {
  const lowered = text.toLowerCase();
  const sessionKeys = ["טיפול", "פגישה", "דיברנו", "שיחה", "session"];
  const taskKeys = ["משימה", "לזכור", "להתקשר", "לשלוח", "לעשות", "task"];
  const guidanceKeys = ["הדרכה", "סופרוויז", "guidance", "supervision"];

  if (guidanceKeys.some((k) => lowered.includes(k))) return DailyEntryType.GUIDANCE;
  if (taskKeys.some((k) => lowered.includes(k))) return DailyEntryType.TASK;
  if (sessionKeys.some((k) => lowered.includes(k))) return DailyEntryType.SESSION;
  return DailyEntryType.UNKNOWN;
}

function extractDateFromText(text: string) {
  const match = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (!match) return todayIsoDate();
  const y = match[1];
  const m = String(Number(match[2])).padStart(2, "0");
  const d = String(Number(match[3])).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function extractTimeFromText(text: string) {
  const match = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!match) return null;
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function patientDisplayName(patient: { firstName: string; lastName: string }) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function buildPatientMatchers(patients: Array<{ id: string; firstName: string; lastName: string }>) {
  return patients.map((patient) => ({
    id: patient.id,
    label: patientDisplayName(patient),
    tokens: [patient.firstName, patient.lastName, patientDisplayName(patient)]
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  }));
}

function autoMatchPatient(
  text: string,
  explicitPatientName: string | null,
  patients: Array<{ id: string; firstName: string; lastName: string }>,
) {
  const candidates = buildPatientMatchers(patients);
  const haystack = `${text} ${explicitPatientName ?? ""}`.toLowerCase();

  const matched = candidates.filter((candidate) => candidate.tokens.some((token) => haystack.includes(token)));
  if (matched.length === 1) {
    return { id: matched[0].id, name: matched[0].label };
  }
  return { id: null, name: null };
}

async function parseViaAi(text: string, patients: Array<{ id: string; firstName: string; lastName: string }>): Promise<DailyParseResult | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const today = todayIsoDate();
  const patientList = patients.map((p) => patientDisplayName(p)).join(", ");
  const systemPrompt = `נתח טקסט חופשי מיומן קליני והחזר JSON בלבד עם השדות:
type (SESSION|TASK|GUIDANCE|UNKNOWN),
patientName (string|null),
date (YYYY-MM-DD),
time (HH:MM|null),
content (string),
title (string|null),
confidence (0-1).
אם חסר תאריך, השתמש ב-${today}.
אם לא ברור סוג, החזר UNKNOWN.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `${systemPrompt}\nמטופלים במערכת: ${patientList || "אין"}`,
      messages: [{ role: "user", content: text }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned) as {
      type?: unknown;
      patientName?: unknown;
      date?: unknown;
      time?: unknown;
      content?: unknown;
      title?: unknown;
      confidence?: unknown;
    };

    const type = normalizeType(parsed.type);
    const patientName = String(parsed.patientName ?? "").trim() || null;
    const patientMatch = autoMatchPatient(text, patientName, patients);
    const confidenceNum = Number(parsed.confidence ?? 0.65);
    const confidence = Number.isFinite(confidenceNum) ? Math.max(0, Math.min(1, confidenceNum)) : 0.65;

    return {
      type,
      patientName,
      matchedPatientId: patientMatch.id,
      matchedPatientName: patientMatch.name,
      date: normalizeDate(String(parsed.date ?? "")),
      time: normalizeTime(String(parsed.time ?? "")),
      content: String(parsed.content ?? text).trim() || text,
      title: String(parsed.title ?? "").trim() || null,
      parserProvider: "anthropic",
      parserConfidence: confidence,
      parseMetaJson: { mode: "ai" },
    };
  } catch {
    return null;
  }
}

function parseFallback(text: string, patients: Array<{ id: string; firstName: string; lastName: string }>): DailyParseResult {
  const type = inferTypeByKeywords(text);
  const patient = autoMatchPatient(text, null, patients);
  return {
    type,
    patientName: patient.name,
    matchedPatientId: patient.id,
    matchedPatientName: patient.name,
    date: extractDateFromText(text),
    time: extractTimeFromText(text),
    content: text.trim(),
    title: type === DailyEntryType.TASK || type === DailyEntryType.GUIDANCE ? text.trim().slice(0, 80) : null,
    parserProvider: "fallback",
    parserConfidence: 0.4,
    parseMetaJson: { mode: "fallback" },
  };
}

export async function parseDailyText(userId: string, text: string): Promise<DailyParseResult> {
  const patients = await prisma.patient.findMany({
    where: { ownerUserId: userId, archivedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500,
  });

  const ai = await parseViaAi(text, patients);
  if (ai) return ai;
  return parseFallback(text, patients);
}

export async function createDailyEntry(userId: string, payload: {
  rawText: string;
  parsedType: DailyEntryType;
  matchedPatientId?: string | null;
  matchedPatientName?: string | null;
  entryDate: string;
  entryTime?: string | null;
  content: string;
  title?: string | null;
  parserProvider?: string | null;
  parserConfidence?: number | null;
  parseMetaJson?: Prisma.InputJsonValue | null;
  status?: DailyEntryStatus;
}) {
  return prisma.dailyEntry.create({
    data: {
      ownerUserId: userId,
      rawText: payload.rawText,
      parsedType: payload.parsedType,
      status: payload.status ?? DailyEntryStatus.READY,
      matchedPatientId: payload.matchedPatientId ?? null,
      matchedPatientName: payload.matchedPatientName ?? null,
      entryDate: new Date(`${payload.entryDate}T00:00:00`),
      entryTime: payload.entryTime ?? null,
      content: payload.content,
      title: payload.title ?? null,
      parserProvider: payload.parserProvider ?? null,
      parserConfidence: payload.parserConfidence ?? null,
      parseMetaJson: payload.parseMetaJson ?? undefined,
    },
  });
}

export async function updateDailyEntry(userId: string, entryId: string, payload: {
  parsedType?: DailyEntryType;
  matchedPatientId?: string | null;
  matchedPatientName?: string | null;
  entryDate?: string;
  entryTime?: string | null;
  content?: string;
  title?: string | null;
  status?: DailyEntryStatus;
  rawText?: string;
}) {
  const existing = await prisma.dailyEntry.findFirst({
    where: { id: entryId, ownerUserId: userId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.dailyEntry.update({
    where: { id: entryId },
    data: {
      ...(payload.parsedType ? { parsedType: payload.parsedType } : {}),
      ...(payload.matchedPatientId !== undefined ? { matchedPatientId: payload.matchedPatientId } : {}),
      ...(payload.matchedPatientName !== undefined ? { matchedPatientName: payload.matchedPatientName } : {}),
      ...(payload.entryDate ? { entryDate: new Date(`${payload.entryDate}T00:00:00`) } : {}),
      ...(payload.entryTime !== undefined ? { entryTime: payload.entryTime } : {}),
      ...(payload.content !== undefined ? { content: payload.content } : {}),
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.rawText !== undefined ? { rawText: payload.rawText } : {}),
    },
  });
}

export async function commitDailyEntry(userId: string, entryId: string) {
  const entry = await prisma.dailyEntry.findFirst({
    where: { id: entryId, ownerUserId: userId },
  });
  if (!entry) return { ok: false as const, status: 404, error: "רשומה יומית לא נמצאה." };

  const parsedType = entry.parsedType;
  const scheduledAt = parseDateTime(entry.entryDate.toISOString().slice(0, 10), entry.entryTime);
  if (!scheduledAt) {
    await prisma.dailyEntry.update({ where: { id: entry.id }, data: { status: DailyEntryStatus.SAVE_FAILED } });
    return { ok: false as const, status: 400, error: "תאריך/שעה לא תקינים." };
  }

  if ((parsedType === DailyEntryType.SESSION || parsedType === DailyEntryType.GUIDANCE) && !entry.matchedPatientId) {
    await prisma.dailyEntry.update({ where: { id: entry.id }, data: { status: DailyEntryStatus.SAVE_FAILED } });
    return { ok: false as const, status: 400, error: "בטיפול/הדרכה חובה לבחור מטופל." };
  }

  try {
    if (parsedType === DailyEntryType.SESSION) {
      const patient = await prisma.patient.findFirst({
        where: { id: entry.matchedPatientId ?? "", ownerUserId: userId, archivedAt: null },
        select: { id: true, defaultSessionFeeNis: true },
      });
      if (!patient) throw new Error("לא ניתן ליצור טיפול למטופל לא פעיל או לא קיים.");

      const session = await prisma.session.create({
        data: {
          patientId: patient.id,
          scheduledAt,
          status: SessionStatus.COMPLETED,
          feeNis: patient.defaultSessionFeeNis ?? null,
          patientState: PatientState.NO_CHANGE,
          sessionNote: entry.content
            ? {
                create: { markdown: entry.content },
              }
            : undefined,
        },
      });

      await prisma.dailyEntry.update({
        where: { id: entry.id },
        data: {
          status: DailyEntryStatus.SAVED,
          targetEntityType: DailyTargetEntityType.SESSION,
          targetEntityId: session.id,
        },
      });
      return { ok: true as const, targetEntityType: DailyTargetEntityType.SESSION, targetEntityId: session.id };
    }

    if (parsedType === DailyEntryType.TASK || parsedType === DailyEntryType.UNKNOWN) {
      if (parsedType === DailyEntryType.UNKNOWN) {
        await prisma.dailyEntry.update({ where: { id: entry.id }, data: { status: DailyEntryStatus.SAVE_FAILED } });
        return { ok: false as const, status: 400, error: "יש לבחור סוג רשומה לפני יצירה." };
      }
      const task = await prisma.task.create({
        data: {
          ownerUserId: userId,
          title: (entry.title ?? "").trim() || entry.content.slice(0, 80) || "משימה חדשה",
          dueAt: scheduledAt,
          patientId: entry.matchedPatientId ?? null,
          status: TaskStatus.OPEN,
        },
      });

      await prisma.dailyEntry.update({
        where: { id: entry.id },
        data: {
          status: DailyEntryStatus.SAVED,
          targetEntityType: DailyTargetEntityType.TASK,
          targetEntityId: task.id,
        },
      });
      return { ok: true as const, targetEntityType: DailyTargetEntityType.TASK, targetEntityId: task.id };
    }

    if (parsedType === DailyEntryType.GUIDANCE) {
      const patient = await prisma.patient.findFirst({
        where: { id: entry.matchedPatientId ?? "", ownerUserId: userId, archivedAt: null },
        select: { id: true },
      });
      if (!patient) throw new Error("לא ניתן ליצור הדרכה למטופל לא פעיל או לא קיים.");

      const guidance = await prisma.guidance.create({
        data: {
          patientId: patient.id,
          title: (entry.title ?? "").trim() || "הדרכה",
          contentMarkdown: entry.content || "",
          notesMarkdown: "",
          status: GuidanceStatus.ACTIVE,
          scheduledAt,
        },
      });

      await prisma.dailyEntry.update({
        where: { id: entry.id },
        data: {
          status: DailyEntryStatus.SAVED,
          targetEntityType: DailyTargetEntityType.GUIDANCE,
          targetEntityId: guidance.id,
        },
      });
      return { ok: true as const, targetEntityType: DailyTargetEntityType.GUIDANCE, targetEntityId: guidance.id };
    }

    await prisma.dailyEntry.update({ where: { id: entry.id }, data: { status: DailyEntryStatus.SAVE_FAILED } });
    return { ok: false as const, status: 400, error: "סוג רשומה לא נתמך." };
  } catch (error) {
    await prisma.dailyEntry.update({ where: { id: entry.id }, data: { status: DailyEntryStatus.SAVE_FAILED } });
    const message = error instanceof Error ? error.message : "unknown";
    return { ok: false as const, status: 500, error: message };
  }
}

export async function listDailyEntries(userId: string, limit = 50): Promise<DailyEntryViewModel[]> {
  const entries = await prisma.dailyEntry.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return entries.map((entry) => ({
    id: entry.id,
    rawText: entry.rawText,
    parsedType: entry.parsedType,
    status: entry.status,
    matchedPatientId: entry.matchedPatientId,
    matchedPatientName: entry.matchedPatientName,
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    entryTime: entry.entryTime,
    content: entry.content,
    title: entry.title,
    parserProvider: entry.parserProvider,
    parserConfidence: entry.parserConfidence,
    targetEntityType: entry.targetEntityType,
    targetEntityId: entry.targetEntityId,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));
}
