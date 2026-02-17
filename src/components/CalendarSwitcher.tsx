"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TaskChecklist } from "@/components/TaskChecklist";

type CalendarSession = {
  id: string;
  patient: string;
  patientId: string;
  startIso: string;
  statusLabel: string;
  href: string;
  kind: "session" | "guidance";
  title?: string;
};

type CalendarTask = {
  id: string;
  title: string;
  dueIso: string;
  patient?: string;
  sessionId?: string;
};

type ViewMode = "week" | "month";

export function CalendarSwitcher({
  sessions,
  tasks,
}: {
  sessions: CalendarSession[];
  tasks: CalendarTask[];
}) {
  const [mode, setMode] = useState<ViewMode>("week");
  const [taskPopup, setTaskPopup] = useState<{ dateLabel: string; tasks: CalendarTask[] } | null>(null);

  const visibleSessions = useMemo(() => {
    const now = new Date();
    return sessions.filter((session) => inRange(new Date(session.startIso), now, mode));
  }, [mode, sessions]);

  const visibleTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter((task) => inRange(new Date(task.dueIso), now, mode));
  }, [mode, tasks]);

  return (
    <section className="app-section">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">יומן</h2>
        <div className="flex gap-1 rounded-xl border border-black/12 p-1 text-[11px]">
          <ModeButton active={mode === "week"} onClick={() => setMode("week")} label="שבועית" />
          <ModeButton active={mode === "month"} onClick={() => setMode("month")} label="חודשית" />
        </div>
      </div>

      {mode === "week" && <WeekBoard sessions={visibleSessions} tasks={visibleTasks} onOpenDayTasks={setTaskPopup} />}
      {mode === "month" && <MonthBoard sessions={visibleSessions} tasks={visibleTasks} onOpenDayTasks={setTaskPopup} />}
      {taskPopup ? <DayTasksModal dateLabel={taskPopup.dateLabel} tasks={taskPopup.tasks} onClose={() => setTaskPopup(null)} /> : null}
    </section>
  );
}

function WeekBoard({
  sessions,
  tasks,
  onOpenDayTasks,
}: {
  sessions: CalendarSession[];
  tasks: CalendarTask[];
  onOpenDayTasks: (payload: { dateLabel: string; tasks: CalendarTask[] }) => void;
}) {
  const start = startOfWeek(new Date());
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const dayTasks = tasks.filter((t) => sameDay(new Date(t.dueIso), day));
        const daySessions = sessions
          .filter((s) => sameDay(new Date(s.startIso), day))
          .sort((a, b) => +new Date(a.startIso) - +new Date(b.startIso));

        return (
          <div key={day.toISOString()} className="min-h-72 rounded-xl border border-black/12 p-2">
            <div className="mb-2 text-[11px] text-muted">{day.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" })}</div>

            <div className="mb-2 rounded-lg bg-app-bg p-1.5">
              <div className="mb-1 text-[10px] font-medium text-muted">משימות</div>
              {dayTasks.length ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpenDayTasks({
                      dateLabel: day.toLocaleDateString("he-IL"),
                      tasks: dayTasks,
                    })
                  }
                  className="w-full rounded bg-white px-2 py-1 text-[10px] text-ink transition hover:bg-accent-soft"
                >
                  {dayTasks.length} משימות
                </button>
              ) : (
                <div className="text-[10px] text-muted">—</div>
              )}
            </div>

            <div className="space-y-1">
              {daySessions.length ? daySessions.map((s) => (
                <Link key={s.id} href={s.href} className={`block rounded-lg px-1.5 py-1 text-[10px] text-ink hover:brightness-[0.98] ${s.kind === "guidance" ? "bg-blue-100" : "bg-accent-soft"}`}>
                  <div className="font-mono tabular-nums">{timeRangeLabel(new Date(s.startIso))}</div>
                  {s.title ? <div className="truncate text-[9px] text-muted">{s.title}</div> : null}
                  <div className="truncate">{s.patient}</div>
                </Link>
              )) : <div className="text-[10px] text-muted">אין פגישות</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthBoard({
  sessions,
  tasks,
  onOpenDayTasks,
}: {
  sessions: CalendarSession[];
  tasks: CalendarTask[];
  onOpenDayTasks: (payload: { dateLabel: string; tasks: CalendarTask[] }) => void;
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstWeekStart = startOfWeek(monthStart);

  const cells = Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(firstWeekStart);
    d.setDate(firstWeekStart.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
      {cells.map((d) => {
        const daySessions = sessions.filter((s) => sameDay(new Date(s.startIso), d));
        const dayTasks = tasks.filter((t) => sameDay(new Date(t.dueIso), d));
        const inMonth = d.getMonth() === now.getMonth();

        return (
          <div key={d.toISOString()} className={`min-h-28 rounded-lg border p-2 ${inMonth ? "border-black/12" : "border-black/5 bg-black/[0.015]"}`}>
            <div className="mb-1 font-mono text-muted">{d.getDate()}</div>
            <div className="space-y-1">
              {dayTasks.length ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpenDayTasks({
                      dateLabel: d.toLocaleDateString("he-IL"),
                      tasks: dayTasks,
                    })
                  }
                  className="block w-full truncate rounded bg-app-bg px-1 py-0.5 text-[10px] text-ink transition hover:bg-accent-soft"
                >
                  {dayTasks.length} משימות
                </button>
              ) : null}
              {daySessions.slice(0, 2).map((s) => (
                <Link key={s.id} href={s.href} className={`block truncate rounded px-1 py-0.5 text-[10px] text-ink ${s.kind === "guidance" ? "bg-blue-100" : "bg-accent-soft"}`}>
                  {timeRangeLabel(new Date(s.startIso))} · {s.title ? `${s.title} · ` : ""}{s.patient}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function timeRangeLabel(start: Date) {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 50);
  return `${start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}-${end.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
}

function DayTasksModal({
  dateLabel,
  tasks,
  onClose,
}: {
  dateLabel: string;
  tasks: CalendarTask[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(90vw,560px)] rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">משימות ליום {dateLabel}</h3>
          <button type="button" onClick={onClose} className="rounded-md border border-black/10 px-2 py-1 text-xs hover:bg-accent-soft">
            סגור
          </button>
        </div>
        <TaskChecklist
          tasks={tasks.map((task) => ({
            id: task.id,
            title: task.title,
            patientName: task.patient,
            href: task.sessionId ? `/sessions/${task.sessionId}` : `/tasks/${task.id}`,
          }))}
        />
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-2.5 py-1 transition ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-black/[0.04]"}`}>
      {label}
    </button>
  );
}

function inRange(date: Date, now: Date, mode: ViewMode) {
  if (mode === "week") {
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return date >= start && date < end;
  }
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
