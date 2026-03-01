"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HebrewDateInput } from "@/components/HebrewDateInput";
import { useQuickActions } from "@/components/QuickActions";

type SessionPayload = {
  id: string;
  status: string;
  location: string;
  feeNis: string;
  scheduledAt: string;
  note: string;
};

// Convert a UTC ISO datetime string (from the server) to local time parts.
// The server always sends UTC (e.g. "2026-02-19T14:00"), appending "Z" makes
// the browser parse it correctly as UTC before converting to local.
function utcToLocalDateTimeStr(utcStr: string) {
  const d = new Date(utcStr + "Z");
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function SessionEditor({ session }: { session: SessionPayload }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useQuickActions();
  const [form, setForm] = useState(session);
  const [isEditing, setIsEditing] = useState(false);
  const localDT = utcToLocalDateTimeStr(session.scheduledAt);
  const [datePart, setDatePart] = useState(localDT.slice(0, 10));
  const [hourPart, setHourPart] = useState(localDT.slice(11, 13));
  const [minutePart, setMinutePart] = useState(localDT.slice(14, 16));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [undocumentedConfirmOpen, setUndocumentedConfirmOpen] = useState(false);
  const [futureWarningOpen, setFutureWarningOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  // Detect merge suggestion from URL
  useEffect(() => {
    const suggestMerge = searchParams.get("suggestMerge") === "true";
    if (suggestMerge) {
      setMergeOpen(true);
    }
  }, [searchParams]);

  async function handleMergeWithRecurring() {
    setMerging(true);
    const res = await fetch(`/api/sessions/${form.id}/merge-recurring`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    setMerging(false);

    if (!res.ok) {
      showToast({ message: "עדכון מועד הפגישה נכשל" });
      return;
    }

    const payload = (await res.json()) as { scheduledAt?: string };
    if (payload.scheduledAt) {
      // Update the form with the new time
      const newLocalDT = utcToLocalDateTimeStr(payload.scheduledAt);
      setDatePart(newLocalDT.slice(0, 10));
      setHourPart(newLocalDT.slice(11, 13));
      setMinutePart(newLocalDT.slice(14, 16));
      setForm((prev) => ({ ...prev, scheduledAt: payload.scheduledAt! }));
    }

    setMergeOpen(false);
    showToast({ message: "הפגישה הועברה למועד הקבוע" });
    router.refresh();
  }

  // Check if status is finalized (not SCHEDULED anymore)
  const isFinalized = form.status !== "SCHEDULED";

  // When finalized and not actively editing — all form fields are read-only
  const isReadOnly = isFinalized && !isEditing;

  async function save(allowUndocumented = false) {
    // Build as local time in browser → correct UTC conversion via toISOString()
    const localStr = `${datePart}T${hourPart}:${minutePart}`;
    const scheduled = new Date(localStr); // browser interprets as local time
    const scheduledAtUTC = scheduled.toISOString(); // → UTC for the server
    const isFuture = scheduled.getTime() > Date.now();
    const isPastSession = !isFuture;
    const hasNote = form.note.trim().length > 0;
    const hasSubstantialNote = form.note.trim().length > 10;
    let nextStatus = form.status;

    // Block completing a session that is still in the future
    if (isFuture && (hasSubstantialNote || form.status === "COMPLETED")) {
      setFutureWarningOpen(true);
      return;
    }

    if (hasSubstantialNote && form.status === "SCHEDULED") {
      // "אשר" button clicked — always mark as completed
      nextStatus = "COMPLETED";
    } else if (isPastSession && form.status === "SCHEDULED") {
      if (hasNote) {
        nextStatus = "COMPLETED";
      } else {
        if (!allowUndocumented) {
          setUndocumentedConfirmOpen(true);
          return;
        }
        nextStatus = "UNDOCUMENTED";
      }
    }

    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        status: nextStatus,
        scheduledAt: scheduledAtUTC,
        feeNis: form.feeNis === "" ? "" : Number(form.feeNis),
      }),
    });
    if (!res.ok) return;
    const payload = (await res.json()) as {
      previous: {
        status: string;
        location: string | null;
        feeNis: number | null;
        scheduledAt: string;
        sessionNote?: { markdown: string } | null;
      };
    };

    showToast({
      message: "פרטי הפגישה עודכנו",
      durationMs: 5000,
      undoLabel: "↺",
      onUndo: async () => {
        await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: payload.previous.status,
            location: payload.previous.location ?? "",
            feeNis: payload.previous.feeNis ?? "",
            scheduledAt: new Date(payload.previous.scheduledAt).toISOString(),
            note: payload.previous.sessionNote?.markdown ?? "",
          }),
        });
        router.refresh();
      },
    });
    router.back();
    router.refresh();
  }

  async function deleteSession() {
    setDeleting(true);
    const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      showToast({ message: "מחיקת פגישה נכשלה" });
      return;
    }
    showToast({ message: "הפגישה נמחקה" });
    router.push("/sessions");
    router.refresh();
  }

  async function cancelSession() {
    setCancelOpen(false);
    setCanceling(true);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELED" }),
    });
    setCanceling(false);
    if (!res.ok) {
      showToast({ message: "ביטול פגישה נכשל" });
      return;
    }
    showToast({ message: "הפגישה סומנה כמבוטלת" });
    router.back();
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/10 bg-white p-4">
      <h2 className="text-lg font-semibold">עריכת פגישה</h2>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="space-y-2">
          <HebrewDateInput
            namePrefix="sessionDate"
            ariaLabelPrefix="תאריך פגישה"
            value={datePart}
            onChange={setDatePart}
            disabled={isReadOnly}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={minutePart}
              onChange={(e) => setMinutePart(e.target.value)}
              className="app-select"
              disabled={isReadOnly}
            >
              {Array.from({ length: 12 }).map((_, idx) => {
                const value = String(idx * 5).padStart(2, "0");
                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>
            <select
              value={hourPart}
              onChange={(e) => setHourPart(e.target.value)}
              className="app-select"
              disabled={isReadOnly}
            >
              {Array.from({ length: 24 }).map((_, hour) => {
                const value = String(hour).padStart(2, "0");
                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <select
          value={form.status}
          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          className="app-select"
          disabled={isReadOnly}
        >
          <option value="SCHEDULED">נקבעה</option>
          <option value="COMPLETED">התקיימה</option>
          <option value="CANCELED">בוטלה</option>
          <option value="CANCELED_LATE">בוטלה מאוחר</option>
          <option value="UNDOCUMENTED">לא תועד</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={form.location}
          onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
          className="app-select"
          disabled={isReadOnly}
        >
          <option value="קליניקה">קליניקה</option>
          <option value="אונליין">אונליין</option>
          <option value="">אחר</option>
        </select>
        <input
          value={form.feeNis}
          onChange={(e) => setForm((p) => ({ ...p, feeNis: e.target.value }))}
          placeholder="מחיר"
          className="app-field"
          readOnly={isReadOnly}
        />
      </div>
      <textarea
        value={form.note}
        onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
        placeholder="תוכן הפגישה"
        className={`app-textarea min-h-32${isReadOnly ? " cursor-default bg-black/[0.02]" : ""}`}
        readOnly={isReadOnly}
      />

      <div className="flex items-center justify-between gap-2">
        {/* Show action buttons only if: not finalized OR in editing mode */}
        {!isFinalized || isEditing ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="app-btn app-btn-secondary"
                disabled={form.status === "CANCELED" || canceling || deleting}
              >
                בטל פגישה
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="app-btn app-btn-secondary text-danger"
                disabled={canceling || deleting}
              >
                מחק פגישה
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setIsEditing(false)} className="app-btn app-btn-secondary">
                ביטול
              </button>
              <button onClick={() => void save()} className="app-btn app-btn-primary">
                {form.note.trim().length > 10 ? "אשר" : "עדכן"}
              </button>
            </div>
          </>
        ) : (
          /* Show only Edit button when finalized */
          <div className="ms-auto">
            <button onClick={() => setIsEditing(true)} className="app-btn app-btn-secondary">
              עריכה
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="מחיקת פגישה"
        message="האם למחוק את הפגישה לצמיתות?\nלא ניתן לשחזר אחרי המחיקה."
        confirmLabel="מחק פגישה"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={deleteSession}
        busy={deleting}
      />
      <ConfirmDialog
        open={cancelOpen}
        title="ביטול פגישה"
        message="האם לסמן את הפגישה כמבוטלת?"
        confirmLabel="בטל פגישה"
        danger={false}
        onCancel={() => setCancelOpen(false)}
        onConfirm={cancelSession}
        busy={canceling}
      />
      <ConfirmDialog
        open={undocumentedConfirmOpen}
        title="אין תוכן פגישה"
        message="אין תוכן פגישה. לסגור עכשיו ולתעד אחר כך?"
        confirmLabel="סגור ללא תיעוד"
        cancelLabel="חזרה לעריכה"
        danger={false}
        onCancel={() => setUndocumentedConfirmOpen(false)}
        onConfirm={() => {
          setUndocumentedConfirmOpen(false);
          void save(true);
        }}
      />
      <ConfirmDialog
        open={futureWarningOpen}
        title="הטיפול במצב עתידי"
        message={"לא ניתן לסגור טיפול שמועדו עדיין לא הגיע.\nהפגישה תישאר במצב 'נקבעה'."}
        confirmLabel="הבנתי"
        danger={false}
        onCancel={() => setFutureWarningOpen(false)}
        onConfirm={() => setFutureWarningOpen(false)}
      />
      <ConfirmDialog
        open={mergeOpen}
        title="אחוד עם הפגישה הקבועה"
        message={"יש לך מטופל עם פגישה קבועה שמועדה שונה מהמועד שבחרת.\nהאם לעדכן את הפגישה למועד הקבוע?"}
        confirmLabel="אחד את הפגישות"
        cancelLabel="שמור בזמן שנבחר"
        danger={false}
        busy={merging}
        onConfirm={handleMergeWithRecurring}
        onCancel={() => setMergeOpen(false)}
      />
    </div>
  );
}
