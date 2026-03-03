"use client";

import Link from "next/link";
import { DailyEntryStatus, DailyEntryType } from "@prisma/client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuickActions } from "@/components/QuickActions";
import type { DailyEntryViewModel, DailyParseResult } from "@/lib/daily-types";

type PatientOption = { id: string; label: string };

type DraftState = {
  rawText: string;
  parsedType: DailyEntryType;
  matchedPatientId: string;
  matchedPatientName: string;
  entryDate: string;
  entryTime: string;
  content: string;
  title: string;
  parserProvider: string;
  parserConfidence: number | null;
  parseMetaJson: Record<string, unknown> | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function initialDraft(): DraftState {
  return {
    rawText: "",
    parsedType: DailyEntryType.SESSION,
    matchedPatientId: "",
    matchedPatientName: "",
    entryDate: todayIso(),
    entryTime: "",
    content: "",
    title: "",
    parserProvider: "",
    parserConfidence: null,
    parseMetaJson: null,
  };
}

export function DailyWorkspace({
  patients,
  initialEntries,
}: {
  patients: PatientOption[];
  initialEntries: DailyEntryViewModel[];
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();

  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [draft, setDraft] = useState<DraftState>(initialDraft());
  const [entries, setEntries] = useState<DailyEntryViewModel[]>(initialEntries);

  const patientOptions = useMemo(() => [{ value: "", label: "ללא שיוך" }, ...patients.map((p) => ({ value: p.id, label: p.label }))], [patients]);
  const entriesForSelectedDay = useMemo(
    () =>
      entries
        .filter((entry) => entry.entryDate === selectedDate)
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt).getTime();
          const bTime = new Date(b.updatedAt).getTime();
          return bTime - aTime;
        }),
    [entries, selectedDate],
  );

  const selectedDateLabel = useMemo(() => formatDayDateLabel(selectedDate), [selectedDate]);

  function applyParseResult(result: DailyParseResult, rawText: string) {
    setDraft({
      rawText,
      parsedType: DailyEntryType.SESSION,
      matchedPatientId: result.matchedPatientId ?? "",
      matchedPatientName: result.matchedPatientName ?? result.patientName ?? "",
      entryDate: result.date,
      entryTime: result.time ?? "",
      content: result.content,
      title: result.title ?? "",
      parserProvider: result.parserProvider ?? "",
      parserConfidence: result.parserConfidence,
      parseMetaJson: result.parseMetaJson,
    });
    setActiveEntryId(null);
  }

  async function onParse() {
    const raw = text.trim();
    if (!raw) return;
    setParsing(true);
    try {
      const res = await fetch("/api/daily/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        showToast({ message: payload.error ?? "ניתוח נכשל. עוברים לעריכה ידנית." });
        applyParseResult(
          {
            type: DailyEntryType.SESSION,
            patientName: null,
            matchedPatientId: null,
            matchedPatientName: null,
            date: selectedDate,
            time: null,
            content: raw,
            title: null,
            parserProvider: "manual-fallback",
            parserConfidence: null,
            parseMetaJson: { mode: "manual" },
          },
          raw,
        );
        return;
      }

      const data = (await res.json()) as DailyParseResult;
      applyParseResult(data, raw);
      if (data.matchedPatientId) {
        showToast({ message: "זוהה מטופל אוטומטית. אפשר לשנות לפני שמירה." });
      }
    } catch {
      showToast({ message: "שגיאת רשת בניתוח. עוברים לעריכה ידנית." });
      applyParseResult(
        {
          type: DailyEntryType.SESSION,
          patientName: null,
          matchedPatientId: null,
          matchedPatientName: null,
          date: selectedDate,
          time: null,
          content: raw,
          title: null,
          parserProvider: "manual-fallback",
          parserConfidence: null,
          parseMetaJson: { mode: "manual" },
        },
        raw,
      );
    } finally {
      setParsing(false);
    }
  }

  async function saveEntry(status: DailyEntryStatus = DailyEntryStatus.READY) {
    if (!draft.rawText.trim() || !draft.content.trim() || !draft.entryDate) {
      showToast({ message: "חסר תוכן חובה לשמירת יומן." });
      return null;
    }

    setSaving(true);
    try {
      const payload = {
        rawText: draft.rawText,
        parsedType: DailyEntryType.SESSION,
        status,
        matchedPatientId: draft.matchedPatientId || null,
        matchedPatientName: draft.matchedPatientName || null,
        entryDate: draft.entryDate,
        entryTime: draft.entryTime || null,
        content: draft.content,
        title: draft.title || null,
        parserProvider: draft.parserProvider || null,
        parserConfidence: draft.parserConfidence,
        parseMetaJson: draft.parseMetaJson,
      };

      if (activeEntryId) {
        const res = await fetch(`/api/daily/entries/${activeEntryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          showToast({ message: err.error ?? "עדכון יומן נכשל." });
          return null;
        }
        showToast({ message: "היומן עודכן." });
        await reloadEntries();
        return activeEntryId;
      }

      const res = await fetch("/api/daily/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        showToast({ message: err.error ?? "שמירת יומן נכשלה." });
        return null;
      }
      const data = (await res.json()) as { entryId: string };
      setActiveEntryId(data.entryId);
      showToast({ message: "היומן נשמר." });
      await reloadEntries();
      return data.entryId;
    } catch {
      showToast({ message: "שגיאת רשת בשמירה." });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function commitEntry() {
    if (!draft.matchedPatientId) {
      showToast({ message: "בטיפול חובה לבחור מטופל." });
      return;
    }
    if (!draft.entryDate) {
      showToast({ message: "חובה לבחור תאריך." });
      return;
    }

    const entryId = activeEntryId ?? (await saveEntry(DailyEntryStatus.READY));
    if (!entryId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/daily/entries/${entryId}/commit`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        showToast({ message: err.error ?? "יצירת רשומה יעד נכשלה." });
        await reloadEntries();
        return;
      }
      const payload = (await res.json()) as { ok: true; targetEntityType: string; targetEntityId: string };
      showToast({ message: "הרשומה נוצרה בהצלחה." });
      await reloadEntries();
      setText("");
      setDraft(emptyDraftForDate(selectedDate));
      setActiveEntryId(null);
      router.push(targetHref(payload.targetEntityType, payload.targetEntityId));
    } finally {
      setSaving(false);
    }
  }

  async function retryCommit(id: string) {
    const res = await fetch(`/api/daily/entries/${id}/retry`, { method: "POST" });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      showToast({ message: err.error ?? "Retry נכשל." });
      return;
    }
    showToast({ message: "בוצע ניסיון חוזר בהצלחה." });
    await reloadEntries();
  }

  async function reloadEntries() {
    const res = await fetch("/api/daily/entries?limit=80", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { entries: DailyEntryViewModel[] };
    setEntries(data.entries ?? []);
  }

  function openEntryForEdit(entry: DailyEntryViewModel) {
    setActiveEntryId(entry.id);
    setSelectedDate(entry.entryDate);
    setText(entry.rawText);
    setDraft({
      rawText: entry.rawText,
      parsedType: DailyEntryType.SESSION,
      matchedPatientId: entry.matchedPatientId ?? "",
      matchedPatientName: entry.matchedPatientName ?? "",
      entryDate: entry.entryDate,
      entryTime: entry.entryTime ?? "",
      content: entry.content,
      title: entry.title ?? "",
      parserProvider: entry.parserProvider ?? "",
      parserConfidence: entry.parserConfidence,
      parseMetaJson: null,
    });
  }
  function moveDay(direction: -1 | 1) {
    const nextDate = shiftIsoDate(selectedDate, direction);
    setSelectedDate(nextDate);
    setActiveEntryId(null);
    setDraft((prev) => ({ ...prev, entryDate: nextDate }));
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">טאבולה ראסה - {selectedDateLabel}</h1>
        <div className="flex items-center gap-2">
          <button type="button" className="app-btn app-btn-secondary" onClick={() => moveDay(1)}>
            היום הבא
          </button>
          <button type="button" className="app-btn app-btn-secondary" onClick={() => moveDay(-1)}>
            היום הקודם
          </button>
          <button
            type="button"
            className="app-btn app-btn-secondary"
            onClick={() => {
              setSelectedDate(todayIso());
              setActiveEntryId(null);
              setDraft((prev) => ({ ...prev, entryDate: todayIso() }));
            }}
          >
            היום
          </button>
        </div>
      </div>

      <section className="app-section space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="app-textarea min-h-36"
          placeholder="הזנה חופשית של מה שקרה היום..."
          disabled={parsing || saving}
        />
        <div className="flex items-center gap-2">
          <button type="button" className="app-btn app-btn-primary" onClick={() => void onParse()} disabled={!text.trim() || parsing || saving}>
            {parsing ? "מנתח…" : "ניתוח"}
          </button>
          <button
            type="button"
            className="app-btn app-btn-secondary"
            onClick={() => {
              setActiveEntryId(null);
              setDraft(emptyDraftForDate(selectedDate));
              setText("");
            }}
            disabled={parsing || saving}
          >
            נקה
          </button>
        </div>
      </section>

      {draft.rawText ? (
        <section className="app-section space-y-3 border-2 border-accent/25 bg-accent-soft/20">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">אישור לפני שמירת טיפול</h2>
            {draft.matchedPatientId ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">זוהה אוטומטית</span> : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted">מטופל</label>
              <select
                className="app-select"
                value={draft.matchedPatientId}
                onChange={(e) => setDraft((prev) => ({ ...prev, matchedPatientId: e.target.value }))}
              >
                {patientOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">תאריך</label>
              <input type="date" className="app-field" value={draft.entryDate} onChange={(e) => setDraft((prev) => ({ ...prev, entryDate: e.target.value }))} />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted">שעה (אופציונלי)</label>
              <input type="time" className="app-field" value={draft.entryTime} onChange={(e) => setDraft((prev) => ({ ...prev, entryTime: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">כותרת</label>
              <input type="text" className="app-field" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="כותרת קצרה לטיפול (אופציונלי)" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted">תוכן</label>
            <textarea className="app-textarea min-h-28" value={draft.content} onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="app-btn app-btn-secondary" onClick={() => void saveEntry(DailyEntryStatus.READY)} disabled={saving}>
              {saving ? "שומר…" : "שמור יומן"}
            </button>
            <button type="button" className="app-btn app-btn-primary" onClick={() => void commitEntry()} disabled={saving}>
              {saving ? "יוצר…" : "צור רשומה יעד"}
            </button>
            <span className="ms-auto text-xs text-muted">ספק ניתוח: {draft.parserProvider || "manual"}</span>
          </div>
        </section>
      ) : null}

      <section
        className="app-section space-y-2"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, rgba(65,66,70,0.06) 0px, rgba(65,66,70,0.06) 1px, transparent 1px, transparent 40px)" }}
      >
        <h2 className="text-sm font-semibold">רשומות יומן ליום {formatDateDDMMYY(selectedDate)}</h2>
        {entriesForSelectedDay.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/14 p-3 text-sm text-muted">אין עדיין רשומות ביום הזה.</div>
        ) : (
          <ul className="space-y-2">
            {entriesForSelectedDay.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-black/12 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => openEntryForEdit(entry)}>
                    {entry.title || entry.content.slice(0, 60) || "רשומה יומית"}
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusTone(entry.status)}`}>{statusLabel(entry.status)}</span>
                  <span className="text-xs text-muted">{formatDateDDMMYY(entry.entryDate)}{entry.entryTime ? ` · ${entry.entryTime}` : ""}</span>
                  <span className="text-xs text-muted">נשמר ב־{formatSavedTime(entry.updatedAt)}</span>
                  <span className="text-xs text-muted">טיפול</span>
                  {entry.targetEntityType && entry.targetEntityId ? (
                    <Link href={targetHref(entry.targetEntityType, entry.targetEntityId)} className="text-xs text-accent hover:underline">
                      פתח רשומה
                    </Link>
                  ) : null}
                  {entry.status === DailyEntryStatus.SAVE_FAILED ? (
                    <button type="button" className="app-btn app-btn-secondary ms-auto text-xs" onClick={() => void retryCommit(entry.id)}>
                      Retry
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{entry.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function emptyDraftForDate(isoDate: string): DraftState {
  return { ...initialDraft(), entryDate: isoDate };
}

function shiftIsoDate(isoDate: string, offsetDays: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function formatDateDDMMYY(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}-${month}-${year.slice(2)}`;
}

function formatDayDateLabel(isoDate: string) {
  const weekday = new Date(`${isoDate}T00:00:00`).toLocaleDateString("he-IL", { weekday: "long" });
  return `${weekday} ${formatDateDDMMYY(isoDate)}`;
}

function formatSavedTime(isoTimestamp: string) {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: DailyEntryStatus) {
  if (status === DailyEntryStatus.DRAFT) return "טיוטה";
  if (status === DailyEntryStatus.READY) return "מוכן";
  if (status === DailyEntryStatus.SAVED) return "נשמר";
  return "נכשל";
}

function statusTone(status: DailyEntryStatus) {
  if (status === DailyEntryStatus.SAVED) return "bg-emerald-100 text-emerald-700";
  if (status === DailyEntryStatus.SAVE_FAILED) return "bg-rose-100 text-rose-700";
  if (status === DailyEntryStatus.READY) return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
}

function targetHref(type: string, id: string) {
  if (type === "SESSION") return `/sessions/${id}`;
  if (type === "TASK") return `/tasks/${id}`;
  if (type === "GUIDANCE") return `/guidance/${id}`;
  return "/daily";
}
