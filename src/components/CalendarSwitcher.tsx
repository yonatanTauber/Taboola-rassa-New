"use client";

import Link from "next/link";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TaskChecklist } from "@/components/TaskChecklist";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, useDraggable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useQuickActions } from "@/components/QuickActions";

const HEB_DAYS_LONG = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// Hourly grid constants (moved to state in WeekBoard for dynamic range)
const HOUR_H = 56; // px per hour

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
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [taskPopup, setTaskPopup] = useState<{ dateLabel: string; tasks: CalendarTask[] } | null>(null);
  const [sessions, setSessions] = useState(initialSessions);
  const [tasks, setTasks] = useState(initialTasks);
  const [dragging, setDragging] = useState<DragItem | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [loading, setLoading] = useState(false);

  // Compute the date range for the current view
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(anchor);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { rangeStart: start, rangeEnd: end };
    } else {
      const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      const end = new Date(start);
      end.setDate(start.getDate() + 42);
      return { rangeStart: start, rangeEnd: end };
    }
  }, [anchor, mode]);

  // Fetch data whenever the range changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const from = rangeStart.toISOString();
    const to = rangeEnd.toISOString();
    fetch(`/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.sessions) setSessions(data.sessions);
        if (data.tasks) setTasks(data.tasks);
      })
      .catch(() => {/* silent – keep old data */})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rangeStart.toISOString(), rangeEnd.toISOString()]);

  const visibleSessions = useMemo(
    () => sessions.filter((s) => {
      const d = new Date(s.startIso);
      return d >= rangeStart && d < rangeEnd;
    }),
    [sessions, rangeStart, rangeEnd]
  );

  const visibleTasks = useMemo(
    () => tasks.filter((t) => {
      const d = new Date(t.dueIso);
      return d >= rangeStart && d < rangeEnd;
    }),
    [tasks, rangeStart, rangeEnd]
  );

  const navigate = useCallback((delta: number) => {
    setAnchor((prev) => {
      const d = new Date(prev);
      if (mode === "week") {
        d.setDate(d.getDate() + delta * 7);
      } else {
        d.setMonth(d.getMonth() + delta);
        d.setDate(1);
      }
      return d;
    });
  }, [mode]);

  const goToday = useCallback(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setAnchor(d);
  }, []);

  const periodLabel = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(anchor);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startStr = start.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
      const endStr = end.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
      return `${startStr} – ${endStr}`;
    } else {
      return anchor.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
    }
  }, [anchor, mode]);

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

    // Fix: parse date as local (not UTC) to avoid off-by-one in Israel (UTC+2)
    const targetDateStr = overId.replace("day:", "");
    const [y, m, day_] = targetDateStr.split("-").map(Number);
    const targetDate = new Date(y, m - 1, day_); // local midnight

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

      setSessions((prev) =>
        prev.map((s) => s.id === rawId ? { ...s, startIso: newDate.toISOString() } : s)
      );

      const endpoint = kind === "guidance" ? `/api/guidance/${rawId}` : `/api/sessions/${rawId}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
      });

      if (!res.ok) {
        setSessions((prev) => prev.map((s) => s.id === rawId ? { ...s, startIso: originalIso } : s));
        setToast({ message: "שגיאה בעדכון התאריך" });
      } else {
        const snapshot = [...sessions];
        router.refresh();
        setToast({
          message: "תאריך עודכן",
          undo: () => {
            setSessions(snapshot);
            fetch(endpoint, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scheduledAt: originalIso }),
            }).then(() => router.refresh());
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
        const snapshot = [...tasks];
        router.refresh();
        setToast({
          message: "תאריך עודכן",
          undo: () => {
            setTasks(snapshot);
            fetch(`/api/tasks/${rawId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dueAt: originalIso }),
            }).then(() => router.refresh());
            setToast(null);
          },
        });
      }
    }

    setTimeout(() => setToast(null), 4000);
  }, [sessions, tasks, router]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isCurrentPeriod = useMemo(() => {
    if (mode === "week") {
      return sameDay(startOfWeek(anchor), startOfWeek(today));
    }
    return anchor.getMonth() === today.getMonth() && anchor.getFullYear() === today.getFullYear();
  }, [anchor, mode, today]);

  // Require 5px movement before a drag starts — lets clicks pass through normally
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <section className="app-section">
      {/* Header: title + nav arrows + mode switcher */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">יומן</h2>
        <div className="flex items-center gap-1 mr-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-black/12 px-2 py-1 text-sm text-muted hover:bg-accent-soft leading-none"
            aria-label="תקופה הבאה"
          >
            ‹
          </button>
          <span className="text-xs font-medium text-ink whitespace-nowrap px-1">
            {loading ? <span className="opacity-40">{periodLabel}</span> : periodLabel}
          </span>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="rounded-lg border border-black/12 px-2 py-1 text-sm text-muted hover:bg-accent-soft leading-none"
            aria-label="תקופה קודמת"
          >
            ›
          </button>
          {!isCurrentPeriod && (
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-black/12 px-2 py-1 text-xs text-accent hover:bg-accent-soft"
            >
              {mode === "week" ? "השבוע" : "החודש"}
            </button>
          )}
        </div>
        <div className="flex gap-1 rounded-xl border border-black/12 p-1 text-[11px]">
          <ModeButton active={mode === "week"} onClick={() => setMode("week")} label="שבועית" />
          <ModeButton active={mode === "month"} onClick={() => setMode("month")} label="חודשית" />
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {mode === "week" && (
          <WeekBoard
            anchor={anchor}
            sessions={visibleSessions}
            tasks={visibleTasks}
            today={today}
            onOpenDayTasks={setTaskPopup}
          />
        )}
        {mode === "month" && (
          <MonthBoard
            anchor={anchor}
            sessions={visibleSessions}
            tasks={visibleTasks}
            today={today}
            onOpenDayTasks={setTaskPopup}
          />
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

function DroppableDay({
  dateKey,
  children,
  className,
  style,
}: {
  dateKey: string;
  children: React.ReactNode;
  className: string;
  style?: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dateKey}` });
  return (
    <div ref={setNodeRef} style={style} className={`${className} ${isOver ? "ring-2 ring-accent ring-inset" : ""}`}>
      {children}
    </div>
  );
}

function DraggableSession({ session }: { session: CalendarSession }) {
  const dragId = `${session.kind}:${session.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });
  const style = transform ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none h-full">
      <Link
        href={session.href}
        className={`block h-full overflow-hidden rounded-md px-1 py-0.5 text-[9px] text-ink hover:brightness-[0.97] cursor-grab active:cursor-grabbing ${session.kind === "guidance" ? "bg-blue-100" : "bg-accent-soft"}`}
        draggable={false}
      >
        <div className="font-mono tabular-nums leading-tight">{timeRangeLabel(new Date(session.startIso))}</div>
        {session.title && <div className="truncate text-[8px] text-muted leading-tight">{session.title}</div>}
        <div className="truncate leading-tight">{session.patient}</div>
      </Link>
    </div>
  );
}

function DraggableSessionCompact({ session }: { session: CalendarSession }) {
  const dragId = `${session.kind}:${session.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });
  const style = transform ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none">
      <Link
        href={session.href}
        className={`block truncate rounded px-1 py-0.5 text-[10px] text-ink cursor-grab active:cursor-grabbing ${session.kind === "guidance" ? "bg-blue-100" : "bg-accent-soft"}`}
        draggable={false}
      >
        {timeRangeLabel(new Date(session.startIso))} · {session.title ? `${session.title} · ` : ""}{session.patient}
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
  anchor,
  sessions,
  tasks,
  today,
  onOpenDayTasks,
}: {
  anchor: Date;
  sessions: CalendarSession[];
  tasks: CalendarTask[];
  today: Date;
  onOpenDayTasks: (payload: { dateLabel: string; tasks: CalendarTask[] }) => void;
}) {
  const { openAction } = useQuickActions();
  const [slotPicker, setSlotPicker] = useState<{ date: Date; hour: number } | null>(null);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(21);

  // Compute hour range based on selected start/end hours
  const HOUR_RANGE = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i
  );
  const GRID_H = HOUR_RANGE.length * HOUR_H;

  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  }).reverse(); // RTL: reverse to Saturday-Sunday ordering

  return (
    <>
      {/* Time range selector */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">יומן</h2>
        <TimeRangeSelector
          startHour={startHour}
          endHour={endHour}
          onStartChange={setStartHour}
          onEndChange={setEndHour}
        />
      </div>

      <div className="overflow-x-auto overflow-y-auto rounded-xl border border-black/12" style={{ maxHeight: "70vh" }}>
        <div dir="ltr" className="flex min-w-[600px]">
          {/* Time axis */}
          <div className="w-11 flex-shrink-0 border-e border-black/8 bg-white">
            <div className="h-8 border-b border-black/8" />
            {HOUR_RANGE.map((h) => (
              <div key={h} style={{ height: HOUR_H }} className="relative border-t border-black/[0.06]">
                <span className="absolute -top-[9px] end-1.5 select-none text-[9px] tabular-nums text-muted">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateKey = toDateKey(day);
            const dayTasks = tasks.filter((t) => sameDay(new Date(t.dueIso), day));
            const daySessions = sessions
              .filter((s) => sameDay(new Date(s.startIso), day))
              .sort((a, b) => +new Date(a.startIso) - +new Date(b.startIso));
            const isToday = sameDay(day, today);

            return (
              <div key={dateKey} className="relative min-w-[72px] flex-1 border-s border-black/8 first:border-s-0">
                {/* Day header */}
                <div className={`sticky top-0 z-20 flex h-8 items-center justify-center gap-1 border-b border-black/8 px-1 text-center text-[10px] ${isToday ? "bg-accent-soft font-semibold text-accent" : "bg-white text-muted"}`}>
                  <span>{`יום ${HEB_DAYS_LONG[day.getDay()]}`}</span>
                  <span className={`inline-flex size-4 items-center justify-center rounded-full text-[10px] ${isToday ? "bg-accent text-white" : ""}`}>
                    {day.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenDayTasks({ dateLabel: day.toLocaleDateString("he-IL"), tasks: dayTasks })}
                      className="ms-0.5 rounded-full bg-amber-100 px-1 text-[9px] text-amber-700 hover:bg-amber-200"
                    >
                      {dayTasks.length}✓
                    </button>
                  )}
                </div>

                {/* Drop zone = the hourly grid */}
                <DroppableDay dateKey={dateKey} className="relative" style={{ height: GRID_H }}>
                  {/* Clickable hour slots */}
                  {HOUR_RANGE.map((h, i) => (
                    <div
                      key={h}
                      onClick={() => setSlotPicker({ date: day, hour: h })}
                      style={{ top: i * HOUR_H, height: HOUR_H }}
                      className="absolute inset-x-0 cursor-pointer border-t border-black/[0.05] transition-colors hover:bg-accent-soft/20"
                    />
                  ))}

                  {/* Sessions positioned by start time */}
                  {daySessions.map((s) => {
                    const startDate = new Date(s.startIso);
                    // Hide sessions outside the selected time range
                    if (startDate.getHours() < startHour || startDate.getHours() >= endHour) return null;
                    const minutesFromStart = (startDate.getHours() - startHour) * 60 + startDate.getMinutes();
                    const top = (minutesFromStart / 60) * HOUR_H;
                    const height = Math.max(24, (50 / 60) * HOUR_H);
                    return (
                      <div
                        key={s.id}
                        style={{ top, height }}
                        className="absolute inset-x-0.5 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DraggableSession session={s} />
                      </div>
                    );
                  })}
                </DroppableDay>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slot picker mini-modal */}
      {slotPicker && (
        <div
          className="fixed inset-0 z-[62] flex items-center justify-center bg-black/10 backdrop-blur-[2px]"
          onClick={() => setSlotPicker(null)}
        >
          <div
            className="w-64 rounded-2xl border border-black/10 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-center text-sm font-semibold text-ink">
              {slotPicker.date.toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "2-digit" })}
              {" · "}
              {String(slotPicker.hour).padStart(2, "0")}:00
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  openAction("session", {
                    date: toDateInput(slotPicker.date),
                    hour: String(slotPicker.hour).padStart(2, "0"),
                    minute: "00",
                  });
                  setSlotPicker(null);
                }}
                className="flex flex-col items-center gap-1 rounded-xl border border-black/10 p-3 text-xs text-ink transition-colors hover:bg-accent-soft"
              >
                <span className="text-xl">🗓</span>
                טיפול
              </button>
              <button
                type="button"
                onClick={() => {
                  // הדרכה — stub, עמוד בפיתוח
                  setSlotPicker(null);
                }}
                className="flex flex-col items-center gap-1 rounded-xl border border-black/10 p-3 text-xs text-ink transition-colors hover:bg-blue-50"
              >
                <span className="text-xl">📚</span>
                הדרכה
              </button>
              <button
                type="button"
                onClick={() => {
                  openAction("task", { date: toDateInput(slotPicker.date) });
                  setSlotPicker(null);
                }}
                className="flex flex-col items-center gap-1 rounded-xl border border-black/10 p-3 text-xs text-ink transition-colors hover:bg-accent-soft"
              >
                <span className="text-xl">✅</span>
                משימה
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSlotPicker(null)}
              className="mt-3 w-full text-xs text-muted hover:text-ink"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MonthBoard({
  anchor,
  sessions,
  tasks,
  today,
  onOpenDayTasks,
}: {
  anchor: Date;
  sessions: CalendarSession[];
  tasks: CalendarTask[];
  today: Date;
  onOpenDayTasks: (payload: { dateLabel: string; tasks: CalendarTask[] }) => void;
}) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const firstWeekStart = startOfWeek(monthStart);

  const cells = Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(firstWeekStart);
    d.setDate(firstWeekStart.getDate() + i);
    return d;
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
        {cells.map((d) => {
          const dateKey = toDateKey(d);
          const daySessions = sessions.filter((s) => sameDay(new Date(s.startIso), d));
          const dayTasks = tasks.filter((t) => sameDay(new Date(t.dueIso), d));
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = sameDay(d, today);

          const dayLabel = `יום ${HEB_DAYS_LONG[d.getDay()]} ${d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}`;

          return (
            <DroppableDay
              key={dateKey}
              dateKey={dateKey}
              className={`min-h-28 rounded-lg border p-2 transition-colors ${
                isToday
                  ? "border-accent bg-accent-soft/20"
                  : inMonth
                  ? "border-black/12"
                  : "border-black/5 bg-black/[0.015]"
              }`}
            >
              <div className={`mb-1 text-[11px] font-medium ${isToday ? "text-accent" : inMonth ? "text-ink" : "text-muted"}`}>
                {dayLabel}
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
                  <DraggableSessionCompact key={s.id} session={s} />
                ))}
                {daySessions.length > 2 && (
                  <div className="text-[9px] text-muted">+{daySessions.length - 2} נוספות</div>
                )}
              </div>
            </DroppableDay>
          );
        })}
      </div>
    </>
  );
}

function TimeRangeSelector({
  startHour,
  endHour,
  onStartChange,
  onEndChange,
}: {
  startHour: number;
  endHour: number;
  onStartChange: (h: number) => void;
  onEndChange: (h: number) => void;
}) {
  const handleStartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = parseInt(e.target.value);
    if (v < endHour) onStartChange(v);
  };
  const handleEndChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = parseInt(e.target.value);
    if (v > startHour) onEndChange(v);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-muted">שעות:</label>
      <select value={startHour} onChange={handleStartChange} className="app-select px-2 py-1 text-sm">
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {String(i).padStart(2, "0")}:00
          </option>
        ))}
      </select>
      <span className="text-muted">עד</span>
      <select value={endHour} onChange={handleEndChange} className="app-select px-2 py-1 text-sm">
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {String(i).padStart(2, "0")}:00
          </option>
        ))}
      </select>
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

// Fix: use local date parts to avoid UTC off-by-one in Israel (UTC+2)
function toDateKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // ראשון = 0
  d.setHours(0, 0, 0, 0);
  return d;
}
