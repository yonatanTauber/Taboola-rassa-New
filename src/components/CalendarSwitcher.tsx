"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TaskChecklist } from "@/components/TaskChecklist";
import { useQuickActions } from "@/components/QuickActions";

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

const HOUR_H = 56; // px per hour
const START_HOUR = 8;
const END_HOUR = 21;
const HOUR_RANGE = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const GRID_H = HOUR_RANGE.length * HOUR_H;

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
  const { openAction } = useQuickActions();
  const [slotPicker, setSlotPicker] = useState<{ date: Date; hour: number } | null>(null);

  const start = startOfWeek(new Date());
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });

  return (
    <>
      <div className="overflow-x-auto overflow-y-auto rounded-xl border border-black/12" style={{ maxHeight: "70vh" }}>
        <div dir="ltr" className="flex min-w-[600px]">
          {/* Time axis */}
          <div className="w-11 flex-shrink-0 border-e border-black/8 bg-white">
            <div className="h-8 border-b border-black/8" />
            {HOUR_RANGE.map((h) => (
              <div key={h} style={{ height: HOUR_H }} className="relative border-t border-black/[0.06]">
                <span className="absolute -top-[9px] end-1.5 text-[9px] tabular-nums text-muted select-none">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayTasks = tasks.filter((t) => sameDay(new Date(t.dueIso), day));
            const daySessions = sessions
              .filter((s) => sameDay(new Date(s.startIso), day))
              .sort((a, b) => +new Date(a.startIso) - +new Date(b.startIso));
            const isToday = sameDay(day, new Date());

            return (
              <div key={day.toISOString()} className="relative flex-1 min-w-[72px] border-s border-black/8 first:border-s-0">
                {/* Day header */}
                <div className={`sticky top-0 z-20 h-8 border-b border-black/8 px-1 text-center text-[10px] flex items-center justify-center gap-1 ${isToday ? "bg-accent-soft text-accent font-semibold" : "bg-white text-muted"}`}>
                  <span>{day.toLocaleDateString("he-IL", { weekday: "short" })}</span>
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

                {/* Grid area */}
                <div className="relative" style={{ height: GRID_H }}>
                  {/* Clickable hour slots */}
                  {HOUR_RANGE.map((h, i) => (
                    <div
                      key={h}
                      onClick={() => setSlotPicker({ date: day, hour: h })}
                      style={{ top: i * HOUR_H, height: HOUR_H }}
                      className="absolute inset-x-0 cursor-pointer border-t border-black/[0.05] transition-colors hover:bg-accent-soft/20"
                    />
                  ))}

                  {/* Sessions */}
                  {daySessions.map((s) => {
                    const startDate = new Date(s.startIso);
                    const minutesFromStart = (startDate.getHours() - START_HOUR) * 60 + startDate.getMinutes();
                    const top = (minutesFromStart / 60) * HOUR_H;
                    const height = Math.max(24, (50 / 60) * HOUR_H);
                    return (
                      <Link
                        key={s.id}
                        href={s.href}
                        onClick={(e) => e.stopPropagation()}
                        style={{ top, height }}
                        className={`absolute inset-x-0.5 z-10 overflow-hidden rounded-md px-1 py-0.5 text-[9px] text-ink hover:brightness-[0.97] ${s.kind === "guidance" ? "bg-blue-100" : "bg-accent-soft"}`}
                      >
                        <div className="font-mono tabular-nums leading-tight">
                          {startDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {s.title ? <div className="truncate leading-tight text-[8px] text-muted">{s.title}</div> : null}
                        <div className="truncate leading-tight">{s.patient}</div>
                      </Link>
                    );
                  })}
                </div>
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
                className="flex flex-col items-center gap-1 rounded-xl border border-black/10 p-3 text-xs text-ink hover:bg-accent-soft transition-colors"
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
                className="flex flex-col items-center gap-1 rounded-xl border border-black/10 p-3 text-xs text-ink hover:bg-blue-50 transition-colors"
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
                className="flex flex-col items-center gap-1 rounded-xl border border-black/10 p-3 text-xs text-ink hover:bg-accent-soft transition-colors"
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

function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}
