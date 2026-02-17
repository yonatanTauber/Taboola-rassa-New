"use client";

import { useMemo, useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, "0"));

const DAY_OPTIONS = [
  { value: "1", label: "א׳" },
  { value: "2", label: "ב׳" },
  { value: "3", label: "ג׳" },
  { value: "4", label: "ד׳" },
  { value: "5", label: "ה׳" },
  { value: "6", label: "ו׳" },
  { value: "0", label: "ש׳" },
];

export function FixedSessionPicker({
  dayInputName = "fixedSessionDay",
  hourInputName = "fixedSessionHour",
  minuteInputName = "fixedSessionMinute",
}: {
  dayInputName?: string;
  hourInputName?: string;
  minuteInputName?: string;
}) {
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");

  const hasDay = day !== "";
  const dayLabel = useMemo(() => DAY_OPTIONS.find((item) => item.value === day)?.label ?? "ללא יום", [day]);

  return (
    <div className="space-y-2 rounded-xl border border-black/12 bg-black/[0.02] p-3">
      <input type="hidden" name={dayInputName} value={day} />
      <input type="hidden" name={hourInputName} value={hasDay ? hour : ""} />
      <input type="hidden" name={minuteInputName} value={hasDay ? minute : ""} />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setDay("");
            setHour("");
            setMinute("");
          }}
          className={`app-btn !h-8 !px-2 !py-0 text-xs ${!hasDay ? "app-btn-primary" : "app-btn-secondary"}`}
          aria-pressed={!hasDay}
        >
          ללא
        </button>
        {DAY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setDay(option.value)}
            className={`app-btn !h-8 !w-8 !px-0 !py-0 text-xs ${day === option.value ? "app-btn-primary" : "app-btn-secondary"}`}
            aria-label={`יום קבוע ${option.label}`}
            aria-pressed={day === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">יום: {dayLabel}</span>
        <span className="text-xs text-muted">בשעה</span>
        <select
          value={hour}
          onChange={(event) => setHour(event.target.value)}
          className="app-select app-select-compact app-time-select"
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
        <span className="text-sm text-muted">:</span>
        <select
          value={minute}
          onChange={(event) => setMinute(event.target.value)}
          className="app-select app-select-compact app-time-select"
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
      </div>
    </div>
  );
}
