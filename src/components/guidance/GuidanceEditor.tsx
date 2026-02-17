"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type InstructorOption = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};

type SessionOption = {
  id: string;
  scheduledAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "CANCELED_LATE" | "UNDOCUMENTED";
  location: string;
  notePreview: string;
};

type EditorInitialData = {
  title: string;
  scheduledAt: string;
  status: "ACTIVE" | "COMPLETED";
  feeNis: number | null;
  completedAt: string;
  contentMarkdown: string;
  notesMarkdown: string;
  instructorId: string;
  patient: { id: string; name: string };
  selectedSessionIds: string[];
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentFilePath: string | null;
  updatedAt: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function GuidanceEditor({
  guidanceId,
  initialData,
  instructors,
  sessions,
  recentCompletedCount,
}: {
  guidanceId: string;
  initialData: EditorInitialData;
  instructors: InstructorOption[];
  sessions: SessionOption[];
  recentCompletedCount: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData.title);
  const [scheduledAt, setScheduledAt] = useState(initialData.scheduledAt);
  const [status, setStatus] = useState<"ACTIVE" | "COMPLETED">(initialData.status);
  const [feeNis, setFeeNis] = useState(initialData.feeNis ? String(initialData.feeNis) : "");
  const [completedAt, setCompletedAt] = useState(initialData.completedAt);
  const [instructorId, setInstructorId] = useState(initialData.instructorId);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(initialData.selectedSessionIds);
  const [contentMarkdown, setContentMarkdown] = useState(initialData.contentMarkdown);
  const [notesMarkdown, setNotesMarkdown] = useState(initialData.notesMarkdown);
  const [attachmentFileName, setAttachmentFileName] = useState(initialData.attachmentFileName);
  const [attachmentMimeType, setAttachmentMimeType] = useState(initialData.attachmentMimeType);
  const [attachmentFilePath, setAttachmentFilePath] = useState(initialData.attachmentFilePath);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savingManual, setSavingManual] = useState(false);
  const [savingAttachment, setSavingAttachment] = useState(false);

  const [instructorOptions, setInstructorOptions] = useState(instructors);
  const [showAddInstructor, setShowAddInstructor] = useState(false);
  const [newInstructorName, setNewInstructorName] = useState("");
  const [newInstructorPhone, setNewInstructorPhone] = useState("");
  const [newInstructorEmail, setNewInstructorEmail] = useState("");
  const [creatingInstructor, setCreatingInstructor] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCheck, setDeleteCheck] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [deleteAttachmentOpen, setDeleteAttachmentOpen] = useState(false);

  const autoTimerRef = useRef<number | null>(null);
  const autoAbortRef = useRef<AbortController | null>(null);
  const savedSnapshotRef = useRef({
    contentMarkdown: initialData.contentMarkdown,
    notesMarkdown: initialData.notesMarkdown,
  });

  const selectedSessionsSet = useMemo(() => new Set(selectedSessionIds), [selectedSessionIds]);
  const [sessionToAddId, setSessionToAddId] = useState("");
  const fileUrl = attachmentFilePath || `/api/guidance/file/${guidanceId}`;
  const isPdfAttachment = (attachmentMimeType ?? "").toLowerCase().includes("pdf");
  const isWordAttachment =
    (attachmentMimeType ?? "").toLowerCase().includes("word") ||
    (attachmentFileName ?? "").toLowerCase().endsWith(".doc") ||
    (attachmentFileName ?? "").toLowerCase().endsWith(".docx");

  useEffect(() => {
    if (
      contentMarkdown === savedSnapshotRef.current.contentMarkdown &&
      notesMarkdown === savedSnapshotRef.current.notesMarkdown
    ) {
      return;
    }

    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
    }
    autoAbortRef.current?.abort();

    autoTimerRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      autoAbortRef.current = controller;
      setSaveState("saving");
      try {
        const payload = {
          contentMarkdown,
          notesMarkdown,
        };
        const res = await fetch(`/api/guidance/${guidanceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Autosave failed (${res.status})`);
        savedSnapshotRef.current = { contentMarkdown, notesMarkdown };
        setSaveState("saved");
        window.setTimeout(() => {
          setSaveState((current) => (current === "saved" ? "idle" : current));
        }, 1200);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSaveState("error");
      }
    }, 600);

    return () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current);
      }
    };
  }, [guidanceId, contentMarkdown, notesMarkdown]);

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current);
      }
      autoAbortRef.current?.abort();
    };
  }, []);

  async function saveManual(options?: { forceComplete?: boolean }) {
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    autoAbortRef.current?.abort();
    const normalizedStatus = options?.forceComplete ? "COMPLETED" : status;
    const normalizedCompletedAt =
      normalizedStatus === "COMPLETED" ? completedAt || toDateTimeInput(new Date()) : "";
    if (normalizedStatus === "COMPLETED" && !completedAt) {
      setCompletedAt(normalizedCompletedAt);
    }
    if (options?.forceComplete) {
      setStatus("COMPLETED");
    }

    const payload = {
      title: title.trim() || "הדרכה ללא כותרת",
      status: normalizedStatus,
      feeNis: feeNis.trim() ? Number(feeNis) : null,
      completedAt: normalizedCompletedAt,
      instructorId: instructorId || null,
      sessionIds: selectedSessionIds,
      contentMarkdown,
      notesMarkdown,
      ...(scheduledAt ? { scheduledAt } : {}),
    };

    setSavingManual(true);
    setSaveState("saving");
    const res = await fetch(`/api/guidance/${guidanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingManual(false);
    if (!res.ok) {
      setSaveState("error");
      let message = "השמירה נכשלה";
      try {
        const err = (await res.json()) as { error?: string };
        if (err.error) message = `השמירה נכשלה: ${err.error}`;
      } catch {}
      window.alert(message);
      return;
    }
    savedSnapshotRef.current = { contentMarkdown, notesMarkdown };
    setSaveState("saved");
    router.refresh();
    window.setTimeout(() => {
      setSaveState((current) => (current === "saved" ? "idle" : current));
    }, 1200);
  }

  async function finishGuidance() {
    setFinishConfirmOpen(false);
    await saveManual({ forceComplete: true });
  }

  async function uploadAttachment(file: File) {
    setSavingAttachment(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/guidance/${guidanceId}/attachment`, {
      method: "POST",
      body,
    });
    setSavingAttachment(false);
    if (!res.ok) {
      window.alert("העלאת הקובץ נכשלה. נתמכים רק PDF/DOC/DOCX.");
      return;
    }
    const payload = (await res.json()) as { fileName: string; mimeType: string; filePath: string };
    setAttachmentFileName(payload.fileName);
    setAttachmentMimeType(payload.mimeType);
    setAttachmentFilePath(payload.filePath);
    router.refresh();
  }

  async function deleteAttachment() {
    setDeleteAttachmentOpen(false);
    setSavingAttachment(true);
    const res = await fetch(`/api/guidance/${guidanceId}/attachment`, { method: "DELETE" });
    setSavingAttachment(false);
    if (!res.ok) {
      window.alert("מחיקת הנספח נכשלה");
      return;
    }
    setAttachmentFileName(null);
    setAttachmentMimeType(null);
    setAttachmentFilePath(null);
    router.refresh();
  }

  async function createInstructorInline() {
    if (!newInstructorName.trim()) return;
    setCreatingInstructor(true);
    const res = await fetch("/api/instructors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: newInstructorName.trim(),
        phone: newInstructorPhone.trim(),
        email: newInstructorEmail.trim(),
      }),
    });
    setCreatingInstructor(false);
    if (!res.ok) {
      window.alert("יצירת מדריך נכשלה");
      return;
    }
    const payload = (await res.json()) as {
      instructor: { id: string; fullName: string; phone: string | null; email: string | null };
    };
    setInstructorOptions((prev) => [...prev, payload.instructor].sort((a, b) => a.fullName.localeCompare(b.fullName, "he")));
    setInstructorId(payload.instructor.id);
    setNewInstructorName("");
    setNewInstructorPhone("");
    setNewInstructorEmail("");
    setShowAddInstructor(false);
  }

  async function deleteGuidance() {
    setDeleting(true);
    const res = await fetch(`/api/guidance/${guidanceId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      window.alert("מחיקת הדרכה נכשלה");
      return;
    }
    router.push("/guidance");
    router.refresh();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <section className="space-y-4">
        <section className="app-section space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="me-auto text-xl font-semibold">הדרכה</h1>
            <span className="text-xs text-muted">
              {saveState === "saving"
                ? "שומר..."
                : saveState === "saved"
                  ? "נשמר"
                  : saveState === "error"
                    ? "שגיאה בשמירה"
                    : "שמירה אוטומטית"}
            </span>
            <button type="button" className="app-btn app-btn-secondary text-danger" onClick={() => setDeleteOpen(true)} disabled={savingManual || deleting}>
              מחק הדרכה
            </button>
            <button type="button" className="app-btn app-btn-secondary" onClick={() => router.back()} disabled={savingManual || deleting}>
              ביטול
            </button>
            <button type="button" className="app-btn app-btn-primary" onClick={() => { void saveManual(); }} disabled={savingManual || deleting}>
              {savingManual ? "מעדכן..." : "עדכן"}
            </button>
            <button type="button" className="app-btn app-btn-secondary" onClick={() => setFinishConfirmOpen(true)} disabled={savingManual || deleting}>
              סיום הדרכה
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">כותרת הדרכה</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="app-field" />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted">מטופל</span>
              <Link href={`/patients/${initialData.patient.id}`} className="block rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-accent hover:underline">
                {initialData.patient.name}
              </Link>
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs text-muted">מועד הדרכה (יופיע ביומן פגישות)</span>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="app-field" />
          </label>

          <div className="grid gap-2 md:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs text-muted">סטטוס</span>
              <select
                className="app-select"
                value={status}
                onChange={(e) => {
                  const next = e.target.value as "ACTIVE" | "COMPLETED";
                  setStatus(next);
                  if (next === "ACTIVE") setCompletedAt("");
                  if (next === "COMPLETED" && !completedAt) setCompletedAt(toDateTimeInput(new Date()));
                }}
              >
                <option value="ACTIVE">פעילה</option>
                <option value="COMPLETED">הושלמה</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted">עלות הדרכה (₪)</span>
              <input
                type="number"
                min={0}
                value={feeNis}
                onChange={(e) => setFeeNis(e.target.value)}
                className="app-field"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted">מדריך</span>
              <select className="app-select" value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
                <option value="">ללא מדריך</option>
                {instructorOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-muted">תאריך השלמה</span>
              <input
                type="datetime-local"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                disabled={status !== "COMPLETED"}
                className="app-field disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="app-btn app-btn-secondary" onClick={() => setShowAddInstructor((prev) => !prev)}>
              {showAddInstructor ? "סגור הוספת מדריך" : "הוספת מדריך מהירה"}
            </button>
          </div>

          <p className="text-xs text-muted">כשסטטוס ההדרכה הוא הושלמה ויש עלות, נוצרת הוצאה אוטומטית בדף הכספים.</p>

          {showAddInstructor ? (
            <div className="rounded-xl border border-black/10 bg-white/90 p-3">
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  value={newInstructorName}
                  onChange={(e) => setNewInstructorName(e.target.value)}
                  placeholder="שם מלא"
                  className="app-field"
                />
                <input
                  value={newInstructorPhone}
                  onChange={(e) => setNewInstructorPhone(e.target.value)}
                  placeholder="טלפון"
                  className="app-field"
                />
                <input
                  value={newInstructorEmail}
                  onChange={(e) => setNewInstructorEmail(e.target.value)}
                  placeholder="אימייל"
                  className="app-field"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!newInstructorName.trim() || creatingInstructor}
                  onClick={createInstructorInline}
                >
                  {creatingInstructor ? "מוסיף..." : "הוסף מדריך"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="app-section space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">תוכן הדרכה</h2>
          </div>
          <textarea
            value={contentMarkdown}
            onChange={(e) => {
              setContentMarkdown(e.target.value);
              setSaveState("saving");
            }}
            className="app-textarea min-h-48"
            placeholder="תוכן ההדרכה..."
          />
        </section>

        <section className="app-section space-y-2">
          <h2 className="text-lg font-semibold">הערות חופשיות</h2>
          <textarea
            value={notesMarkdown}
            onChange={(e) => {
              setNotesMarkdown(e.target.value);
              setSaveState("saving");
            }}
            className="app-textarea min-h-40"
            placeholder="הערות חופשיות..."
          />
        </section>
      </section>

      <section className="space-y-4">
        <section className="app-section space-y-2">
          <h2 className="text-lg font-semibold">נספח</h2>
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="app-field"
            disabled={savingAttachment}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              uploadAttachment(file);
              e.currentTarget.value = "";
            }}
          />

          {attachmentFileName ? (
            <div className="rounded-lg border border-black/10 bg-white/90 p-2 text-sm">
              <div className="mb-2 text-ink">{attachmentFileName}</div>
              {isPdfAttachment ? (
                <div className="space-y-2">
                  <iframe src={fileUrl} className="h-[46vh] w-full rounded-lg border border-black/10" title="נספח PDF" />
                  <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                    פתח PDF בחלון חדש
                  </a>
                </div>
              ) : isWordAttachment ? (
                <a href={fileUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  פתח / הורד קובץ Word
                </a>
              ) : (
                <a href={fileUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  פתח נספח
                </a>
              )}
              <div className="mt-2">
                <button type="button" className="app-btn app-btn-secondary text-danger" onClick={() => setDeleteAttachmentOpen(true)} disabled={savingAttachment}>
                  מחק נספח
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted">אין נספח להדרכה זו.</div>
          )}
        </section>

        <section className="app-section space-y-2">
          <h2 className="text-lg font-semibold">קישור לפגישות (אופציונלי)</h2>
          <div className="text-xs text-muted">מוצגות פגישות שהתקיימו בחודש האחרון. אפשר להוסיף/להסיר קישורים ולפתוח הרחבה לכל פגישה.</div>
          <div className="text-xs text-muted">נמצאו {recentCompletedCount} פגישות שהתקיימו בחודש האחרון.</div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <select
              className="app-select"
              value={sessionToAddId}
              onChange={(e) => setSessionToAddId(e.target.value)}
            >
              <option value="">בחר פגישה לקישור</option>
              {sessions
                .filter((session) => !selectedSessionsSet.has(session.id))
                .map((session) => (
                  <option key={session.id} value={session.id}>
                    {new Date(session.scheduledAt).toLocaleString("he-IL")} · {sessionLabel(session.status)}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="app-btn app-btn-secondary"
              onClick={() => {
                if (!sessionToAddId) return;
                setSelectedSessionIds((prev) => [...prev, sessionToAddId]);
                setSessionToAddId("");
              }}
            >
              הוסף קישור
            </button>
          </div>

          <ul className="max-h-[45vh] space-y-2 overflow-auto">
            {sessions
              .filter((session) => selectedSessionsSet.has(session.id))
              .map((session) => (
                <li key={session.id} className="rounded-lg border border-black/10 bg-white/90 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="grow text-sm">
                      {new Date(session.scheduledAt).toLocaleString("he-IL")} · {sessionLabel(session.status)}
                    </div>
                    <button
                      type="button"
                      className="app-btn app-btn-secondary !px-2 !py-1 text-xs text-danger"
                      onClick={() => setSelectedSessionIds((prev) => prev.filter((id) => id !== session.id))}
                    >
                      הסר
                    </button>
                  </div>
                  <details className="mt-1 rounded-md border border-black/10 bg-white/80 p-2">
                    <summary className="cursor-pointer text-xs text-accent">הצצה / הרחבה לפגישה</summary>
                    <div className="mt-2 space-y-1 text-xs text-muted">
                      <div>מיקום: {session.location || "ללא מיקום"}</div>
                      <div>סטטוס: {sessionLabel(session.status)}</div>
                      <div className="rounded border border-black/8 bg-white p-2 text-ink">
                        {session.notePreview ? session.notePreview.slice(0, 500) : "אין תוכן פגישה להצגה."}
                      </div>
                      <Link href={`/sessions/${session.id}`} className="text-accent hover:underline">
                        פתיחת דף הפגישה המלא
                      </Link>
                    </div>
                  </details>
                </li>
              ))}
          </ul>
          {selectedSessionIds.length === 0 ? <div className="text-sm text-muted">אין פגישות מקושרים.</div> : null}
        </section>
      </section>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-3"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" className="w-[min(92vw,32rem)] rounded-2xl border border-black/16 bg-white p-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-danger">מחיקה הרסנית של הדרכה</h3>
            <p className="mt-1 text-sm text-muted">
              המחיקה תמחק לצמיתות את ההדרכה, את הוצאת ההדרכה המקושרת ואת קובץ הנספח.
            </p>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deleteCheck} onChange={(e) => setDeleteCheck(e.target.checked)} className="size-4 accent-accent" />
              אני מאשר/ת מחיקה לצמיתות
            </label>

            <label className="mt-2 block space-y-1">
              <span className="text-xs text-muted">להשלמה יש להקליד: מחיקה</span>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="app-field"
                placeholder="מחיקה"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="app-btn app-btn-secondary" onClick={() => setDeleteOpen(false)}>
                ביטול
              </button>
              <button
                type="button"
                className="app-btn bg-danger/10 text-danger disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!deleteCheck || deleteConfirmText.trim() !== "מחיקה" || deleting}
                onClick={deleteGuidance}
              >
                {deleting ? "מוחק..." : "מחיקה לצמיתות"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={finishConfirmOpen}
        title="סיום הדרכה"
        message="האם לסמן את ההדרכה כהושלמה?"
        confirmLabel="כן, סמן כהושלמה"
        danger={false}
        onCancel={() => setFinishConfirmOpen(false)}
        onConfirm={finishGuidance}
        busy={savingManual}
      />
      <ConfirmDialog
        open={deleteAttachmentOpen}
        title="מחיקת נספח"
        message="האם למחוק את הנספח מההדרכה?\nלא ניתן לשחזר אחרי המחיקה."
        confirmLabel="מחק נספח"
        onCancel={() => setDeleteAttachmentOpen(false)}
        onConfirm={deleteAttachment}
        busy={savingAttachment}
      />
    </div>
  );
}

function sessionLabel(status: SessionOption["status"]) {
  if (status === "COMPLETED") return "התקיימה";
  if (status === "CANCELED") return "בוטלה";
  if (status === "CANCELED_LATE") return "בוטלה מאוחר";
  if (status === "UNDOCUMENTED") return "לא תועד";
  return "נקבעה";
}

function toDateTimeInput(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
