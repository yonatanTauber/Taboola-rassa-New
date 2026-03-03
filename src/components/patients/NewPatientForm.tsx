"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomSelect } from "@/components/CustomSelect";
import { FixedSessionPicker } from "@/components/patients/FixedSessionPicker";

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function NewPatientForm({
  action,
  error,
}: {
  action: (formData: FormData) => void;
  error: string | null;
}) {
  const [gender, setGender] = useState("");
  const defaultTreatmentStartDate = toDateInput(new Date());

  return (
    <>
      {error ? (
        <div className="mb-3 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <form action={action} className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2">
          <input required name="firstName" placeholder="שם פרטי *" className="app-field" />
          <input required name="lastName" placeholder="שם משפחה *" className="app-field" />
          <CustomSelect
            value={gender}
            onChange={setGender}
            options={[
              { value: "", label: "מגדר (אופציונלי)" },
              { value: "MALE", label: "גבר" },
              { value: "FEMALE", label: "אישה" },
              { value: "OTHER", label: "אחר" },
            ]}
            placeholder="מגדר (אופציונלי)"
            name="gender"
          />
          <input name="phone" placeholder="טלפון ליצירת קשר (אופציונלי)" className="app-field" />
          <input name="email" placeholder="אימייל" className="app-field" />
          <label className="space-y-1">
            <div className="text-xs text-muted">תאריך לידה</div>
            <input name="dateOfBirth" type="date" lang="he-IL" className="app-field" />
          </label>
          <div className="space-y-2 md:col-span-2 md:grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:items-start md:gap-2">
            <label className="space-y-1">
              <div className="text-xs text-muted">תאריך התחלת טיפול</div>
              <input
                name="treatmentStartDate"
                type="date"
                lang="he-IL"
                defaultValue={defaultTreatmentStartDate}
                className="app-field"
              />
            </label>

            <div className="space-y-1">
              <div className="text-xs text-muted">יום ושעה קבועים (אופציונלי)</div>
              <FixedSessionPicker />
            </div>
          </div>
          <input
            name="defaultSessionFeeNis"
            type="number"
            min="0"
            placeholder="מחיר טיפול קבוע (₪)"
            className="app-field"
          />
        </div>

        <div className="rounded-xl border border-black/10 p-3">
          <h2 className="mb-2 text-sm font-semibold">אינטייק</h2>
          <div className="grid gap-2">
            <input name="referralReason" placeholder="סיבת פנייה" className="app-field" />
            <textarea name="goals" placeholder="מטרות טיפול" className="app-textarea min-h-20" />
            <input name="previousTherapy" placeholder="טיפול קודם" className="app-field" />
            <input name="currentMedication" placeholder="טיפול תרופתי" className="app-field" />
            <input name="hospitalizations" placeholder="אשפוזים בעבר" className="app-field" />
            <textarea name="freeText" placeholder="מלל חופשי" className="app-textarea min-h-24" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link href="/patients" className="app-btn app-btn-secondary">
            ביטול
          </Link>
          <button className="app-btn app-btn-primary">
            שמור
          </button>
        </div>
      </form>
    </>
  );
}
