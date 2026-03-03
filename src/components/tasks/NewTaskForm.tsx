"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomSelect } from "@/components/CustomSelect";

type PatientOption = { id: string; firstName: string; lastName: string };

function formatPatientName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function NewTaskForm({
  patients,
  initialPatientId,
  selectedId,
  action,
}: {
  patients: PatientOption[];
  initialPatientId: string;
  selectedId: string | null;
  action: (formData: FormData) => void;
}) {
  const [patientId, setPatientId] = useState(initialPatientId);

  return (
    <form action={action} className="space-y-3">
      <label className="space-y-1">
        <div className="text-xs text-muted">שיוך למטופל (אופציונלי)</div>
        <CustomSelect
          value={patientId}
          onChange={setPatientId}
          options={[
            { value: "", label: "משימה כללית לקליניקה" },
            ...patients.map((patient) => ({
              value: patient.id,
              label: formatPatientName(patient.firstName, patient.lastName),
            })),
          ]}
          placeholder="משימה כללית לקליניקה"
          name="patientId"
          searchable
        />
      </label>

      <label className="space-y-1">
        <div className="text-xs text-muted">משימה</div>
        <input name="title" required className="app-field" placeholder="מה צריך לבצע?" />
      </label>

      <label className="space-y-1">
        <div className="text-xs text-muted">תאריך לביצוע</div>
        <input name="dueAt" type="date" defaultValue={toDateInput(new Date())} className="app-field" />
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-ink">
        <input name="withReminder" type="checkbox" className="accent-accent" />
        תזכורת במערכת
      </label>

      <div className="flex justify-end gap-2">
        <Link href={selectedId ? `/patients/${selectedId}` : "/tasks"} className="app-btn app-btn-secondary">ביטול</Link>
        <button type="submit" className="app-btn app-btn-primary">אישור</button>
      </div>
    </form>
  );
}
