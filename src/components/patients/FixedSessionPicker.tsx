"use client";

import { useMemo, useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, "0"));

const DAY_OPTIONS = [
  { value: "", label: "ללא יום קבוע" },
  { value: "1", label: "ראשון" },
  { value: "2", label: "שני" },
  { value: "3", label: "שלישי" },
  { value: "4", label: "רביעי" },
  { value: "5", label: "חמישי" },
  { value: "6", label: "שישי" },
  { value: "0", label: "שבת" },
];

export function FixedSessionPicker({
  dayInputName = "fixedSessionDay",
  hourInputName = "fixedSessionHour",
  minuteInputName = "fixedSessionMinute",
  durationInputName = "fixedSessionDuration",
}: {
  dayInputName?: string;
  hourInputName?: string;
  minuteInputName?: string;
  durationInputName?: string;
}) {
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [duration, setDuration] = useState("50");

  const hasDay = day !== "";
  const dayLabel = useMemo(() => DAY_OPTIONS.find((item) => item.value === day)?.label ?? "ללא יום קבוע", [day]);

  return (
    <div className="rounded-xl border border-black/12 bg-black/[0.02] p-3">
      <input type="hidden" name={dayInputName} value={day} />
      <input type="hidden" name={hourInputName} value={hasDay ? hour : ""} />
      <input type="hidden" name={minuteInputName} value={hasDay ? minute : ""} />
      <input type="hidden" name={durationInputName} value={duration} />

      <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <label className="space-y-1">
          <span className="text-xs text-muted">יום קבוע</span>
          <select
            value={day}
            onChange={(event) => {
              const nextDay = event.target.value;
              setDay(nextDay);
              if (!nextDay) {
                setHour("");
                setMinute("");
              }
            }}
            className="app-select"
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option.value || "none"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted">זמן התחלה - שעה</span>
          <select
            value={hour}
            onChange={(event) => setHour(event.target.value)}
            className="app-select"
            disabled={!hasDay}
            aria-label="שעה קבועה"
          >
            <option value="">שעה</option>
            {HOURS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted">זמן התחלה - דקות</span>
          <select
            value={minute}
            onChange={(event) => setMinute(event.target.value)}
            className="app-select"
            disabled={!hasDay}
            aria-label="דקות קבועות"
          >
            <option value="">דקות</option>
            {MINUTES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs text-muted">משך הפגישה (דקות)</span>
          <input
            type="number"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            min="15"
            max="180"
            step="5"
            disabled={!hasDay}
            className="app-input"
            aria-label="משך הפגישה"
            placeholder="50"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-muted">
        {hasDay ? `יום קבוע: ${dayLabel}${hour && minute ? ` · התחלה ${hour}:${minute} · משך ${duration}דק׳` : ""}` : "לא נקבע יום ושעה קבועים"}
      </p>
    </div>
  );
}
