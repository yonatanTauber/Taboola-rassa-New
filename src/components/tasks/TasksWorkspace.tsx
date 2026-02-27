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
  patientInactive?: boolean;
  sessionId?: string;
};

type PatientOption = {
  id: string;
  name: string;
};

type ScopeFilter = "ALL" | "OPEN" | "DONE" | "CANCELED" | "THIS_WEEK";

function weekStart(now: Date) {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay()); // Sunday = 0
  d.setHours(0, 0, 0, 0);
  return d;
}

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
  initialScopeFilter?: ScopeFilter;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [patientFilter, setPatientFilter] = useState(initialPatientFilter);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(initialScopeFilter as ScopeFilter);
  const [busyTaskId, setBusyTaskId] = useState("");

  const nowTs = useMemo(() => new Date(nowIso).getTime(), [nowIso]);

  const stats = useMemo(() => {
    const now = new Date(nowIso);
    const ws = weekStart(now);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 7);

    const open = tasks.filter((t) => t.status === "OPEN").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const canceled = tasks.filter((t) => t.status === "CANCELED").length;
    const thisWeek = tasks.filter(
      (t) =>
        t.status === "OPEN" &&
        t.dueAt &&
        new Date(t.dueAt) >= ws &&
        new Date(t.dueAt) < we,
    ).length;
    return { open, done, canceled, thisWeek };
  }, [tasks, nowIso]);

  const filtered = useMemo(() => {
    const now = new Date(nowIso);
    const ws = weekStart(now);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 7);

    return tasks.filter((task) => {
      if (patientFilter === "GENERAL" && task.patientId) return false;
      if (patientFilter !== "ALL" && patientFilter !== "GENERAL" && task.patientId !== patientFilter) return false;
      if (scopeFilter === "OPEN" && task.status !== "OPEN") return false;
      if (scopeFilter === "DONE" && task.status !== "DONE") return false;
      if (scopeFilter === "CANCELED" && task.status !== "CANCELED") return false;
      if (scopeFilter === "THIS_WEEK") {
        if (task.status !== "OPEN") return false;
        if (!task.dueAt) return false;
        const due = new Date(task.dueAt);
        if (due < ws || due >= we) return false;
      }
      return true;
    });
  }, [tasks, patientFilter, scopeFilter, nowIso]);

  function toggle(scope: ScopeFilter) {
    setScopeFilter((s) => (s === scope ? "ALL" : scope));
  }

  return (
    <main className="space-y-4">
      {/* KPI bar */}
      <section className="app-section">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="משימות פתוחות"
            value={stats.open}
            colorClass="bg-amber-50 border-amber-200 text-amber-700"
            activeColorClass="bg-amber-100 border-amber-400 text-amber-800"
            active={scopeFilter === "OPEN"}
            onClick={() => toggle("OPEN")}
          />
          <KpiCard
            label="משימות לשבוע"
            value={stats.thisWeek}
            colorClass="bg-accent-soft border-accent/30 text-accent"
            activeColorClass="bg-accent/10 border-accent text-accent"
            active={scopeFilter === "THIS_WEEK"}
            onClick={() => toggle("THIS_WEEK")}
          />
          <KpiCard
            label="משימות שבוצעו"
            value={stats.done}
            colorClass="bg-emerald-50 border-emerald-200 text-emerald-700"
            activeColorClass="bg-emerald-100 border-emerald-400 text-emerald-800"
            active={scopeFilter === "DONE"}
            onClick={() => toggle("DONE")}
          />
          <KpiCard
            label="משימות שבוטלו"
            value={stats.canceled}
            colorClass="bg-black/[0.03] border-black/10 text-muted"
            activeColorClass="bg-black/[0.07] border-black/20 text-ink"
            active={scopeFilter === "CANCELED"}
            onClick={() => toggle("CANCELED")}
          />
        </div>
      </section>

      {/* Filters */}
      <section className="app-section">
        <div className="grid gap-3 lg:grid-cols-2">
          <select value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)} className="app-select">
            <option value="ALL">כל המטופלים</option>
            <option value="GENERAL">משימות כלליות</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.name}</option>
            ))}
          </select>
          <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)} className="app-select">
            <option value="ALL">כל המשימות</option>
            <option value="OPEN">פתוחות</option>
            <option value="THIS_WEEK">לשבוע הנוכחי</option>
            <option value="DONE">בוצעו</option>
            <option value="CANCELED">בוטלו</option>
          </select>
        </div>
      </section>

      {/* Task list */}
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
              <div>
                {task.patientName ? `מטופל: ${task.patientName}` : "משימה כללית"}
                {task.patientName && task.patientInactive ? " · לא פעיל" : ""}
              </div>
              <div>{task.dueAt ? new Date(task.dueAt).toLocaleDateString("he-IL") : "ללא תאריך"}</div>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? <div className="text-sm text-muted">אין משימות שתואמות לסינון.</div> : null}
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  colorClass,
  activeColorClass,
  active,
  onClick,
}: {
  label: string;
  value: number;
  colorClass: string;
  activeColorClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-start transition-all hover:brightness-[0.97] active:scale-[0.98] ${active ? activeColorClass : colorClass}`}
    >
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
    </button>
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
