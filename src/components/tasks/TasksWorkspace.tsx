"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuickActions } from "@/components/QuickActions";

type TaskRow = {
  id: string;
  title: string;
  status: "OPEN" | "DONE" | "CANCELED";
  dueAt?: string;
  patientId?: string;
  patientName?: string;
  sessionId?: string;
};

type PatientOption = {
  id: string;
  name: string;
};

export function TasksWorkspace({
  tasks,
  patients,
  nowIso,
  initialPatientFilter = "ALL",
  initialScopeFilter = "ALL",
}: {
  tasks: TaskRow[];
  patients: PatientOption[];
  nowIso: string;
  initialPatientFilter?: string;
  initialScopeFilter?: "ALL" | "OPEN" | "DONE" | "FUTURE";
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [patientFilter, setPatientFilter] = useState(initialPatientFilter);
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "OPEN" | "DONE" | "FUTURE">(initialScopeFilter);
  const [busyTaskId, setBusyTaskId] = useState("");

  const nowTs = useMemo(() => new Date(nowIso).getTime(), [nowIso]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (patientFilter === "GENERAL" && task.patientId) return false;
      if (patientFilter !== "ALL" && patientFilter !== "GENERAL" && task.patientId !== patientFilter) return false;
      if (scopeFilter === "OPEN" && task.status !== "OPEN") return false;
      if (scopeFilter === "DONE" && task.status !== "DONE") return false;
      if (scopeFilter === "FUTURE") {
        if (task.status !== "OPEN") return false;
        if (!task.dueAt) return false;
        if (new Date(task.dueAt).getTime() <= nowTs) return false;
      }
      return true;
    });
  }, [tasks, patientFilter, scopeFilter, nowTs]);

  const stats = useMemo(() => {
    const open = tasks.filter((t) => t.status === "OPEN").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const future = tasks.filter((t) => t.status === "OPEN" && t.dueAt && new Date(t.dueAt).getTime() > nowTs).length;
    return { open, done, future };
  }, [tasks, nowTs]);

  return (
    <main className="space-y-4">
      <section className="app-section">
        <h1 className="text-xl font-semibold">מרכז משימות</h1>
        <p className="text-sm text-muted">סינון לפי מטופל, סטטוס ולוח זמנים.</p>
      </section>

      <section className="app-section">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr]">
          <select value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)} className="app-select">
            <option value="ALL">כל המטופלים</option>
            <option value="GENERAL">משימות כלליות</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.name}</option>
            ))}
          </select>
          <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as "ALL" | "OPEN" | "DONE" | "FUTURE")} className="app-select">
            <option value="ALL">כל המשימות</option>
            <option value="OPEN">משימות לביצוע</option>
            <option value="DONE">משימות שבוצעו</option>
            <option value="FUTURE">משימות עתידיות</option>
          </select>
          <div className="flex items-center gap-2 text-xs">
            <Stat label="לביצוע" value={stats.open} />
            <Stat label="בוצעו" value={stats.done} />
            <Stat label="עתידיות" value={stats.future} />
          </div>
        </div>
      </section>

      <section className="app-section space-y-2">
        {filtered.map((task) => (
          <div
            key={task.id}
            className="rounded-lg border border-black/16 bg-white/95 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.status === "DONE"}
                  disabled={busyTaskId === task.id || task.status === "CANCELED"}
                  onChange={async (e) => {
                    const nextDone = e.target.checked;
                    setBusyTaskId(task.id);
                    const res = await fetch(`/api/tasks/${task.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: nextDone ? "DONE" : "OPEN" }),
                    });
                    setBusyTaskId("");
                    if (!res.ok) {
                      showToast({ message: "עדכון משימה נכשל" });
                      return;
                    }
                    showToast({ message: nextDone ? "המשימה סומנה כבוצעה" : "המשימה חזרה לפתוחה", durationMs: 2200 });
                    router.refresh();
                  }}
                  className="size-4 accent-accent"
                  title="סמן בוצע / פתוח"
                />
                <Link
                  href={task.sessionId ? `/sessions/${task.sessionId}` : `/tasks/${task.id}`}
                  className={`min-w-0 truncate hover:underline ${task.status === "DONE" ? "text-muted line-through" : "text-ink"}`}
                >
                  {task.title}
                </Link>
              </div>
              <div className={`rounded-full px-2 py-0.5 text-xs ${badgeTone(task.status)}`}>{statusLabel(task.status)}</div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
              <div>{task.patientName ? `מטופל: ${task.patientName}` : "משימה כללית"}</div>
              <div>{task.dueAt ? new Date(task.dueAt).toLocaleDateString("he-IL") : "ללא תאריך"}</div>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? <div className="text-sm text-muted">אין משימות שתואמות לסינון.</div> : null}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white px-2 py-1">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function statusLabel(status: TaskRow["status"]) {
  if (status === "DONE") return "בוצעה";
  if (status === "CANCELED") return "בוטלה";
  return "פתוחה";
}

function badgeTone(status: TaskRow["status"]) {
  if (status === "DONE") return "bg-emerald-100 text-emerald-700";
  if (status === "CANCELED") return "bg-black/[0.08] text-muted";
  return "bg-amber-100 text-amber-700";
}
