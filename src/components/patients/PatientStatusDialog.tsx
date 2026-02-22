"use client";

import { useState } from "react";

type PatientStatusDialogMode = "setInactive" | "reactivate";

export function PatientStatusDialog({
  open,
  mode,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  mode: PatientStatusDialogMode;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    date: string;
    reason: string;
    cancelFutureSessions: boolean;
    closeOpenTasks: boolean;
  }) => Promise<void> | void;
}) {
  const [date, setDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [cancelFutureSessions, setCancelFutureSessions] = useState(true);
  const [closeOpenTasks, setCloseOpenTasks] = useState(true);

  if (!open) return null;

  function resetForm() {
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
    setDate(today);
    setReason("");
    setCancelFutureSessions(true);
    setCloseOpenTasks(true);
  }

  const isReactivate = mode === "reactivate";

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/30 px-3"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          resetForm();
          onCancel();
        }
      }}
    >
      <div role="dialog" aria-modal="true" className="w-[min(92vw,34rem)] rounded-2xl border border-black/16 bg-white p-4 shadow-2xl">
        <h3 className={`text-lg font-semibold ${isReactivate ? "text-ink" : "text-danger"}`}>
          {isReactivate ? "השבת מטופל למצב פעיל" : "העברת מטופל למצב לא פעיל"}
        </h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
          {isReactivate
            ? "התיק נשמר תמיד. להשבה לפעילות יש להזין תאריך חזרה וסיבה."
            : "המטופל לא יוצע ליצירת פגישות/משימות/קישורים חדשים, אבל התיק נשמר וזמין לצפייה."}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-muted">{isReactivate ? "תאריך חזרה לטיפול *" : "תאריך מעבר ללא פעיל *"}</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="app-field" />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted">{isReactivate ? "סיבת חזרה לטיפול *" : "סיבה (אופציונלי)"}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="app-textarea min-h-20"
              placeholder={isReactivate ? "מה הסיבה לחזרה לטיפול?" : "רשות: תיעוד פנימי לסיבת המעבר ללא פעיל"}
            />
          </label>

          {!isReactivate ? (
            <div className="rounded-xl border border-black/12 bg-black/[0.02] p-3 text-sm">
              <div className="mb-2 text-xs text-muted">פעולות אופציונליות בעת מעבר ללא פעיל</div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cancelFutureSessions}
                  onChange={(event) => setCancelFutureSessions(event.target.checked)}
                  className="size-4 accent-accent"
                />
                <span>בטל פגישות עתידיות של המטופל</span>
              </label>
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={closeOpenTasks}
                  onChange={(event) => setCloseOpenTasks(event.target.checked)}
                  className="size-4 accent-accent"
                />
                <span>סגור משימות פתוחות של המטופל</span>
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="app-btn app-btn-secondary" onClick={() => { resetForm(); onCancel(); }} disabled={busy}>
            ביטול
          </button>
          <button
            type="button"
            className={`app-btn ${isReactivate ? "app-btn-primary" : "bg-danger/10 text-danger"} disabled:cursor-not-allowed disabled:opacity-60`}
            disabled={Boolean(busy) || !date || (isReactivate && !reason.trim())}
            onClick={() =>
              onSubmit({
                date,
                reason: reason.trim(),
                cancelFutureSessions,
                closeOpenTasks,
              })
            }
          >
            {busy ? "מבצע..." : isReactivate ? "השב לפעיל" : "העבר ללא פעיל"}
          </button>
        </div>
      </div>
    </div>
  );
}
