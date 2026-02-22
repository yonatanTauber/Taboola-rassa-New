"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuickActions } from "@/components/QuickActions";

type Row = {
  id: string;
  title: string;
  status: string;
  dueAt?: string;
  completedAt?: string;
  sessionId?: string;
};

export function PatientTasksPanel({
  tasks,
  patientId,
  patientInactive = false,
}: {
  tasks: Row[];
  patientId: string;
  patientInactive?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState("");

  const rows = useMemo(() => {
    return tasks.filter((task) => {
      if (!showDone && task.status === "DONE") return false;
      if (!q.trim()) return true;
      return task.title.toLowerCase().includes(q.trim().toLowerCase());
    });
  }, [q, showDone, tasks]);

  return (
    <section className="app-section border-black/18">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">משימות מטופל</h2>
          {patientInactive ? (
            <span
              className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded border border-black/12 bg-black/[0.05] text-center text-sm text-muted"
              title="לא ניתן להוסיף משימה למטופל לא פעיל"
            >
              +
            </span>
          ) : (
            <Link
              href={`/tasks/new?patientId=${patientId}`}
              className="app-btn app-btn-secondary h-7 w-7 !px-0 text-center text-sm"
              title="הוספת משימה למטופל"
            >
              +
            </Link>
          )}
        </div>
        <Link href={`/tasks?patientId=${patientId}`} className="app-btn app-btn-secondary text-xs">מעבר לדף כל המשימות</Link>
      </div>

      {patientInactive ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          המטופל במצב לא פעיל ולכן לא ניתן ליצור משימות חדשות.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש משימה"
          className="min-w-52 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink"
        />
        <label className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-accent" />
          הצג משימות שבוצעו
        </label>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((task) => {
          const href = task.sessionId ? `/sessions/${task.sessionId}` : `/tasks/${task.id}`;
          const done = task.status === "DONE";
          return (
            <li key={task.id} className="rounded-lg border border-black/10 px-3 py-2">
              <div className="flex min-w-0 items-start gap-2">
                <button
                  type="button"
                  disabled={done || busyId === task.id}
                  className={`mt-0.5 inline-flex size-5 items-center justify-center rounded border text-xs ${
                    done ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-black/20 bg-white hover:bg-black/[0.02]"
                  }`}
                  onClick={async () => {
                    setBusyId(task.id);
                    const res = await fetch(`/api/tasks/${task.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "DONE" }),
                    });
                    setBusyId("");
                    if (!res.ok) {
                      showToast({ message: "עדכון משימה נכשל" });
                      return;
                    }
                    showToast({
                      message: "המשימה סומנה כבוצעה",
                      durationMs: 4500,
                      undoLabel: "↩",
                      onUndo: async () => {
                        await fetch(`/api/tasks/${task.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "OPEN" }),
                        });
                        router.refresh();
                      },
                    });
                    router.refresh();
                  }}
                  title="סמן כבוצע"
                >
                  ✓
                </button>
                <div className="min-w-0 flex-1">
                  <Link href={href} className={`font-medium hover:underline ${done ? "text-muted line-through" : "text-accent"}`}>
                    {task.title}
                  </Link>
                </div>
              </div>
              <div className={`mt-1 text-xs ${done ? "text-emerald-600" : "text-rose-600"}`}>
                {done
                  ? `תאריך ביצוע: ${task.completedAt ? new Date(task.completedAt).toLocaleDateString("he-IL") : "בוצעה"}`
                  : `תאריך לביצוע: ${task.dueAt ? new Date(task.dueAt).toLocaleDateString("he-IL") : "לא הוגדר"}`}
              </div>
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="rounded-lg bg-black/[0.02] px-3 py-2 text-muted">לא נמצאו משימות לפי הסינון.</li>
        ) : null}
      </ul>
    </section>
  );
}
