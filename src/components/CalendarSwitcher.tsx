"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import { TaskChecklist } from "@/components/TaskChecklist";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const HEB_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export type CalendarSession = {
  id: string;
  patient: string;
  patientId: string;
  startIso: string;
  statusLabel: string;
  href: string;
  kind: "session" | "guidance";
  title?: string;
};

export type CalendarTask = {
  id: string;
  title: string;
  dueIso: string;
  patient?: string;
  sessionId?: string;
};

type ViewMode = "week" | "month";

type DragItem =
  | { type: "session"; item: CalendarSession }
  | { type: "task"; item: CalendarTask };

export function CalendarSwitcher({
  sessions: initialSessions,
  tasks: initialTasks,
}: {
  sessions: CalendarSession[];
  tasks: CalendarTask[];
}) {
  const [mode, setMode] = useState<ViewMode>("week");
  const [taskPopup, setTaskPopup] = useState<{ dateLabel: string; tasks: CalendarTask[] } | null>(null);
  const [sessions, setSessions] = useState(initialSessions);
  const [tasks, setTasks] = useState(initialTasks);
  const [dragging, setDragging] = useState<DragItem | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);

  const visibleSessions = useMemo(() => {
    const now = new Date();
    return sessions.filter((s) => inRange(new Date(s.startIso), now, mode));
  }, [mode, sessions]);

  const visibleTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter((t) => inRange(new Date(t.dueIso), now, mode));
  }, [mode, tasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id.toString();
    if (id.startsWith("session:") || id.startsWith("guidance:")) {
      const rawId = id.replace(/^(session|guidance):/, "");
      const item = sessions.find((s) => s.id === rawId);
      if (item) setDragging({ type: "session", item });
    } else if (id.startsWith("task:")) {
      const rawId = id.replace("task:", "");
      const item = tasks.find((t) => t.id === rawId);
      if (item) setDragging({ type: "task", item });
    }
  }, [sessions, tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();
    if (!overId.startsWith("day:")) return;

    const targetDateStr = overId.replace("day:", "");
    const targetDate = new Date(targetDateStr);

    if (activeId.startsWith("session:") || activeId.startsWith("guidance:")) {
      const kind = activeId.startsWith("guidance:") ? "guidance" : "session";
      const rawId = activeId.replace(/^(session|guidance):/, "");
      const original = sessions.find((s) => s.id === rawId);
      if (!original) return;

      const originalIso = original.startIso;
      const originalTime = new Date(originalIso);
      const newDate = new Date(targetDate);
      newDate.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);
      if (sameDay(originalTime, newDate)) return;

      // optimistic update
      setSessions((prev) =>
        prev.map((s) => s.id === rawId ? { ...s, startIso: newDate.toISOString() } : s)
      );

      const res = await fetch(`/api/${kind === "guidance" ? "guidance" : "sessions"}/${rawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
      });

      if (!res.ok) {
        setSessions((prev) => prev.map((s) => s.id === rawId ? { ...s, startIso: originalIso } : s));
        setToast({ message: "שגיאה בעדכון התאריך" });
      } else {
        setToast({
          message: "תאריך עודכן",
          undo: () => {
            setSessions((prev) => prev.map((s) => s.id === rawId ? { ...s, startIso: originalIso } : s));
            fetch(`/api/${kind === "guidance" ? "guidance" : "sessions"}/${rawId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scheduledAt: originalIso }),
            });
            setToast(null);
          },
        });
      }
    } else if (activeId.startsWith("task:")) {
      const rawId = activeId.replace("task:", "");
      const original = tasks.find((t) => t.id === rawId);
      if (!original) return;

      const originalIso = original.dueIso;
      const originalTime = new Date(originalIso);
      const newDate = new Date(targetDate);
      newDate.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);
      if (sameDay(originalTime, newDate)) return;

      setTasks((prev) =>
        prev.map((t) => t.id === rawId ? { ...t, dueIso: newDate.toISOString() } : t)
      );

      const res = await fetch(`/api/tasks/${rawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: newDate.toISOString() }),
      });

      if (!res.ok) {
        setTasks((prev) => prev.map((t) => t.id === rawId ? { ...t, dueIso: originalIso } : t));
        setToast({ message: "שגיאה בעדכון התאריך" });
      } else {
        setToast({
          message: "תאריך עודכן",
          undo: () => {
            setTasks((prev) => prev.map((t) => t.id === rawId ? { ...t, dueIso: originalIso } : t));
            fetch(`/api/tasks/${rawId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dueAt: originalIso }),
            });
            setToast(null);
          },
        });
      }
    }

    setTimeout(() => setToast(null), 4000);
  }, [sessions, tasks]);

  return (
    <section className="app-section">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">יומן</h2>
        <div className="flex gap-1 rounded-xl border border-black/12 p-1 text-[11px]">
          <ModeButton active={mode === "week"} onClick={() => setMode("week")} label="שבועית" />
          <ModeButton active={mode === "month"} onClick={() => setMode("month")} label="חודשית" />
        </div>
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {mode === "week" && (
          <WeekBoard sessions={visibleSessions} tasks={visibleTasks} onOpenDayTasks={setTaskPopup} />
        )}
        {mode === "month" && (
          <MonthBoard sessions={visibleSessions} tasks={visibleTasks} onOpenDayTasks={setTaskPopup} />
        )}
        <DragOverlay>
          {dragging?.type === "session" && (
            <div className={`rounded-lg px-2 py-1 text-[10px] text-ink shadow-lg ${dragging.item.kind === "guidance" ? "bg-blue-100" : "bg-accent-soft"}`}>
              {dragging.item.patient}
            </div>
          )}
          {dragging?.type === "task" && (
            <div className="rounded-lg bg-white px-2 py-1 text-[10px] text-ink shadow-lg border border-black/10">
              {dragging.item.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {taskPopup && (
        <DayTasksModal dateLabel={taskPopup.dateLabel} tasks={taskPopup.tasks} onClose={() => setTaskPopup(null)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-2xl">
          <span>{toast.message}</span>
          {toast.undo && (
            <button type="button" onClick={toast.undo} className="rounded-lg border border-white/30 px-2 py-0.5 text-xs hover:bg-white/10">
              בטל
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function DroppableDay({ dateKey, children, className }: { dateKey: string; children: React.ReactNode; className: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateKey}` });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? "ring-2 ring-accent ring-inset" : ""}`}>
      {children}
    </div>
  );
}

function DraggableSession({ session }: { session: CalendarSession }) {
  const dragId = `${session.kind}:${session.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });
  const style = transform ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none">
      <Link
        href={session.href}
        className={`block rounded-lg px-1.5 py-1 text-[10px] text-ink hover:brightness-[0.98] cursor-grab active:cursor-grabbing ${session.kind === "guidance" ? "bg-blue-100" : "bg-accent-soft"}`}
        onClick={(e) => { if (isDragging) e.preventDefault(); }}
      >
        <div className="font-mono tabular-nums">{timeRangeLabel(new Date(session.startIso))}</div>
        {session.title && <div className="truncate text-[9px] text-muted">{session.title}</div>}
        <div className="truncate">{session.patient}</div>
      </Link>
    </div>
  );
}

function DraggableTask({ task, onOpen }: { task: CalendarTask; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `task:${task.id}` });
  const style = transform ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none">
      <button
        type="button"
        onClick={() => { if (!isDragging) onOpen(); }}
        className="w-full rounded bg-white px-2 py-1 text-[10px] text-ink transition hover:bg-accent-soft cursor-grab active:cursor-grabbing"
      >
        {task.title.length > 20 ? task.title.slice(0, 20) + "…" : task.title}
      </button>
    </div>
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
        const dateKey = day.toISOString().split("T")[0];
        const dayTasks = tasks.filter((t) => sameDay(new Date(t.dueIso), day));
        const daySessions = sessions
          .filter((s) => sameDay(new Date(s.startIso), day))
          .sort((a, b) => +new Date(a.startIso) - +new Date(b.startIso));

        return (
          <DroppableDay
            key={dateKey}
            dateKey={dateKey}
            className="min-h-72 rounded-xl border border-black/12 p-2 transition-colors"
          >
            <div className="mb-2 text-[11px] text-muted">
              {day.toLocaleDateString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </div>

            <div className="mb-2 rounded-lg bg-app-bg p-1.5">
              <div className="mb-1 text-[10px] font-medium text-muted">משימות</div>
              {dayTasks.length ? (
                <div className="space-y-1">
                  {dayTasks.map((t) => (
                    <DraggableTask
                      key={t.id}
                      task={t}
                      onOpen={() => onOpenDayTasks({ dateLabel: day.toLocaleDateString("he-IL"), tasks: dayTasks })}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-muted">—</div>
              )}
            </div>

            <div className="space-y-1">
              {daySessions.length ? (
                daySessions.map((s) => <DraggableSession key={s.id} session={s} />)
              ) : (
                <div className="text-[10px] text-muted">אין פגישות</div>
              )}
            </div>
          </DroppableDay>
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
        const dateKey = d.toISOString().split("T")[0];
        const daySessions = sessions.filter((s) => sameDay(new Date(s.startIso), d));
        const dayTasks = tasks.filter((t) => sameDay(new Date(t.dueIso), d));
        const inMonth = d.getMonth() === now.getMonth();

        return (
          <DroppableDay
            key={dateKey}
            dateKey={dateKey}
            className={`min-h-28 rounded-lg border p-2 transition-colors ${inMonth ? "border-black/12" : "border-black/5 bg-black/[0.015]"}`}
          >
            <div className="mb-1 font-mono text-muted text-[11px]">
              {HEB_DAYS[d.getDay()]} {d.getDate()}
            </div>
            <div className="space-y-1">
              {dayTasks.length ? (
                <button
                  type="button"
                  onClick={() => onOpenDayTasks({ dateLabel: d.toLocaleDateString("he-IL"), tasks: dayTasks })}
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
          </DroppableDay>
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

function DayTasksModal({ dateLabel, tasks, onClose }: { dateLabel: string; tasks: CalendarTask[]; onClose: () => void }) {
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
  d.setDate(d.getDate() - d.getDay()); // יום ראשון = 0
  d.setHours(0, 0, 0, 0);
  return d;
}
