"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { HebrewDateInput } from "@/components/HebrewDateInput";
import { formatPatientName } from "@/lib/patient-name";

// Helper: calculate next occurrence of weekday (0=Sun, 6=Sat) in Israel timezone
function getNextRecurringDate(fixedSessionDay: number, fixedSessionTime: string): { date: string; time: string; dayName: string } {
  const TZ = "Asia/Jerusalem";

  // Convert UI day (1=Sun, 0=Sat) to 0-indexed (0=Sun, 6=Sat)
  const targetWeekday = ((fixedSessionDay - 1) + 7) % 7;

  // Get current date in Israel timezone
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    dateStyle: "short",
  }).format(now);

  // Helper: get weekday (0=Sun, 6=Sat) in Israel timezone
  function getIsraelWeekday(date: Date): number {
    const dayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date);
    const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return days[dayName] ?? 0;
  }

  const current = new Date(`${dateStr}T00:00:00Z`);
  const currentWeekday = getIsraelWeekday(current);

  let dayDiff = (targetWeekday - currentWeekday + 7) % 7;
  if (dayDiff === 0) dayDiff = 7; // Always next week's occurrence

  const nextDate = new Date(current);
  nextDate.setUTCDate(nextDate.getUTCDate() + dayDiff);

  const nextDateStr = nextDate.toISOString().slice(0, 10);
  const dayName = new Date(`${nextDateStr}T12:00:00Z`).toLocaleDateString("he-IL", { weekday: "long" });

  return {
    date: nextDateStr,
    time: fixedSessionTime,
    dayName,
  };
}

function toDbFixedSessionDay(dateStr: string) {
  const base = new Date(`${dateStr}T12:00:00`);
  const jsDay = base.getDay(); // 0=Sun..6=Sat
  return jsDay === 6 ? 0 : jsDay + 1;
}

function getFixedDateForWeek(dateStr: string, fixedSessionDay: number) {
  const base = new Date(`${dateStr}T12:00:00`);
  const currentDay = base.getDay(); // 0=Sun..6=Sat
  const targetDay = ((fixedSessionDay - 1) + 7) % 7;
  const diff = targetDay - currentDay;
  const fixedDate = new Date(base);
  fixedDate.setDate(base.getDate() + diff);
  return fixedDate.toISOString().slice(0, 10);
}

type PatientOption = {
  id: string;
  firstName: string;
  lastName: string;
  defaultSessionFeeNis: number | null;
  fixedSessionDay: number | null;
  fixedSessionTime: string | null;
};

type FutureSessionOption = {
  id: string;
  patientId: string;
  scheduledAtIso: string;
};

export function SessionCreateForm({
  patients,
  initialPatientId,
  initialDate,
  initialTime,
  error,
  futureSessions,
  action,
}: {
  patients: PatientOption[];
  initialPatientId: string;
  initialDate: string;
  initialTime: string;
  error: string | null;
  futureSessions: FutureSessionOption[];
  action: (formData: FormData) => void;
}) {
  const [patientId, setPatientId] = useState(initialPatientId);
  const [dateValue, setDateValue] = useState(initialDate);
  const [timeValue, setTimeValue] = useState(initialTime);
  const [scheduleAction, setScheduleAction] = useState<"move_fixed" | "add_extra" | "use_fixed" | "">("");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === patientId) ?? null,
    [patients, patientId],
  );

  const weekdayLabel = useMemo(() => {
    const dt = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString("he-IL", { weekday: "long" });
  }, [dateValue]);

  const patientFutureSessions = useMemo(
    () => futureSessions.filter((item) => item.patientId === patientId).slice(0, 8),
    [futureSessions, patientId],
  );

  const recurringSessionSuggestion = useMemo(() => {
    if (!selectedPatient?.fixedSessionDay || !selectedPatient?.fixedSessionTime) {
      return null;
    }
    return getNextRecurringDate(selectedPatient.fixedSessionDay, selectedPatient.fixedSessionTime);
  }, [selectedPatient]);

  const hasFixedSchedule = Boolean(selectedPatient?.fixedSessionDay && selectedPatient?.fixedSessionTime);
  const isFixedSelection =
    hasFixedSchedule &&
    toDbFixedSessionDay(dateValue) === selectedPatient?.fixedSessionDay &&
    timeValue === selectedPatient?.fixedSessionTime;

  const handleDateChange = (next: string) => {
    setDateValue(next);
    setScheduleAction("");
  };

  const submitWithAction = (
    nextAction: "move_fixed" | "add_extra" | "use_fixed",
    overrides?: { date?: string; time?: string },
  ) => {
    const actionInput = formRef.current?.querySelector('input[name="scheduleAction"]') as HTMLInputElement | null;
    if (actionInput) actionInput.value = nextAction;
    setScheduleAction(nextAction);
    setShowScheduleDialog(false);
    setTimeout(() => {
      if (overrides) {
        const form = formRef.current;
        const dateInput = form?.querySelector('input[name="date"]') as HTMLInputElement | null;
        const timeInput = form?.querySelector('input[name="time"]') as HTMLInputElement | null;
        if (overrides.date && dateInput) dateInput.value = overrides.date;
        if (overrides.time && timeInput) timeInput.value = overrides.time;
      }
      formRef.current?.requestSubmit();
    }, 0);
  };

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3"
      onSubmit={(event) => {
        if (hasFixedSchedule && !isFixedSelection && !scheduleAction) {
          event.preventDefault();
          setShowScheduleDialog(true);
        }
      }}
    >
      {error ? <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

      <input type="hidden" name="scheduleAction" value={scheduleAction} />

      <label className="space-y-1">
        <div className="text-xs text-muted">מטופל</div>
        <select
          name="patientId"
          value={patientId}
          onChange={(e) => {
            setPatientId(e.target.value);
            setScheduleAction("");
            const nextPatient = patients.find((p) => p.id === e.target.value);
            if (
              nextPatient?.fixedSessionDay &&
              nextPatient.fixedSessionTime &&
              (toDbFixedSessionDay(dateValue) !== nextPatient.fixedSessionDay ||
                timeValue !== nextPatient.fixedSessionTime)
            ) {
              setShowScheduleDialog(true);
            }
          }}
          className="app-select"
          required
        >
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {formatPatientName(patient.firstName, patient.lastName)}
            </option>
          ))}
        </select>
      </label>

      {recurringSessionSuggestion ? (
        <div className="rounded-xl border border-blue-300/50 bg-blue-50/80 p-3 text-sm">
          <div className="mb-2 font-semibold text-blue-800">
            🗓️ פגישה שבועית קבועה
          </div>
          <div className="mb-3 text-blue-700">
            <strong>{recurringSessionSuggestion.dayName}</strong> בשעה{" "}
            <strong>{recurringSessionSuggestion.time}</strong>
          </div>
          <button
            type="button"
            onClick={() => {
              setDateValue(recurringSessionSuggestion.date);
              setTimeValue(recurringSessionSuggestion.time);
            }}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            ← השתמש בזמן הקבוע
          </button>
        </div>
      ) : null}

      {patientFutureSessions.length > 0 ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/80 p-3 text-sm">
          <div className="mb-1 font-semibold text-amber-800">נמצאו פגישות עתידיים למטופל</div>
          <div className="text-amber-700">אפשר לערוך פגישה קיים במקום ליצור כפילות:</div>
          <ul className="mt-2 space-y-1">
            {patientFutureSessions.map((session) => (
              <li key={session.id}>
                <Link href={`/sessions/${session.id}`} className="text-accent hover:underline">
                  {new Date(session.scheduledAtIso).toLocaleDateString("he-IL")} ·{" "}
                  {new Date(session.scheduledAtIso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-xl border border-black/14 bg-white/80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs text-muted">תאריך</div>
          <div className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{weekdayLabel}</div>
        </div>
        <HebrewDateInput
          value={dateValue}
          onChange={handleDateChange}
          namePrefix="session-create-date"
          ariaLabelPrefix="תאריך פגישה"
        />
        <input type="hidden" name="date" value={dateValue} />
      </div>

      <label className="space-y-1">
        <div className="text-xs text-muted">שעת המפגש</div>
        <input
          type="time"
          name="time"
          step={300}
          value={timeValue}
          onChange={(e) => {
            setTimeValue(e.target.value);
            setScheduleAction("");
          }}
          className="app-field max-w-44"
          required
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs text-muted">מיקום</div>
          <select name="location" defaultValue="קליניקה" className="app-select">
            <option value="קליניקה">קליניקה</option>
            <option value="אונליין">אונליין</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-muted">מחיר (₪)</div>
          <input
            type="number"
            min="0"
            name="feeNis"
            defaultValue={selectedPatient?.defaultSessionFeeNis ?? ""}
            className="app-field"
          />
        </label>
      </div>

      <label className="space-y-1">
        <div className="text-xs text-muted">תוכן פגישה (אופציונלי)</div>
        <textarea name="note" className="app-textarea min-h-28" placeholder="תוכן הפגישה..." />
      </label>

      <div className="flex justify-end gap-2">
        <Link href={patientId ? `/patients/${patientId}` : "/sessions"} className="app-btn app-btn-secondary">ביטול</Link>
        <button type="submit" className="app-btn app-btn-primary">אישור</button>
      </div>

      {showScheduleDialog && hasFixedSchedule && selectedPatient?.fixedSessionDay && selectedPatient?.fixedSessionTime ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/30 px-3 backdrop-blur-sm">
          <div className="w-[min(92vw,520px)] rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">
            <div className="mb-2 text-lg font-semibold text-ink">לפני יצירת פגישה</div>
            <p className="text-sm text-muted">
              למטופל יש פגישה קבועה. בחר/י איך להתייחס לתאריך שבחרת.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <button
                type="button"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-start transition hover:bg-accent-soft"
                onClick={() => {
                  submitWithAction("move_fixed");
                }}
              >
                קביעת הטיפול הנוכחי במקום הטיפול הקבוע
                <span className="block text-xs text-muted">הקבוע יתעדכן לזמן שבחרת</span>
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-start transition hover:bg-accent-soft"
                onClick={() => {
                  const fixedDate = getFixedDateForWeek(dateValue, selectedPatient.fixedSessionDay!);
                  setDateValue(fixedDate);
                  const fixedTime = selectedPatient.fixedSessionTime ?? timeValue;
                  setTimeValue(fixedTime);
                  submitWithAction("use_fixed", { date: fixedDate, time: fixedTime });
                }}
              >
                הזנה עם נתוני הטיפול הקבוע
                <span className="block text-xs text-muted">הפגישה תיכנס ביום/שעה הקבועים</span>
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-start transition hover:bg-accent-soft"
                onClick={() => {
                  submitWithAction("add_extra");
                }}
              >
                פגישה נוספת למטופל
                <span className="block text-xs text-muted">הקבוע נשאר כמו שהוא</span>
              </button>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScheduleDialog(false)}
                className="app-btn app-btn-secondary"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
