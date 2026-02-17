"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HebrewDateInput } from "@/components/HebrewDateInput";
import { formatPatientName } from "@/lib/patient-name";

type PatientOption = {
  id: string;
  firstName: string;
  lastName: string;
  defaultSessionFeeNis: number | null;
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

  return (
    <form action={action} className="space-y-3">
      {error ? <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

      <label className="space-y-1">
        <div className="text-xs text-muted">מטופל</div>
        <select
          name="patientId"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
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
          onChange={setDateValue}
          namePrefix="session-create-date"
          ariaLabelPrefix="תאריך פגישה"
        />
        <input type="hidden" name="date" value={dateValue} />
      </div>

      <label className="space-y-1">
        <div className="text-xs text-muted">שעת המפגש</div>
        <input type="time" name="time" step={300} defaultValue={initialTime} className="app-field max-w-44" required />
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
    </form>
  );
}
