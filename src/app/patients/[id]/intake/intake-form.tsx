"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuickActions } from "@/components/QuickActions";

type IntakeData = {
  referralReason: string | null;
  goals: string | null;
  previousTherapy: string | null;
  currentMedication: string | null;
  hospitalizations: string | null;
  riskAssessment: string | null;
  freeText: string | null;
};

interface IntakeFormProps {
  patientId: string;
  initialIntake: IntakeData | undefined;
  saveIntake: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
}

export function IntakeForm({ patientId, initialIntake, saveIntake }: IntakeFormProps) {
  const { showToast } = useQuickActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    referralReason: initialIntake?.referralReason ?? "",
    goals: initialIntake?.goals ?? "",
    previousTherapy: initialIntake?.previousTherapy ?? "",
    currentMedication: initialIntake?.currentMedication ?? "",
    hospitalizations: initialIntake?.hospitalizations ?? "",
    riskAssessment: initialIntake?.riskAssessment ?? "",
    freeText: initialIntake?.freeText ?? "",
  });

  const validateForm = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!form.referralReason.trim()) {
      errors.push("סיבת הפנייה");
    }
    if (!form.goals.trim()) {
      errors.push("מטרות טיפול");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validation = validateForm();
    if (!validation.valid) {
      showToast({
        message: `שדות חובה חסרים: ${validation.errors.join(", ")}`,
        durationMs: 4000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("patientId", patientId);
      formData.append("referralReason", form.referralReason.trim());
      formData.append("goals", form.goals.trim());
      formData.append("previousTherapy", form.previousTherapy.trim());
      formData.append("currentMedication", form.currentMedication.trim());
      formData.append("hospitalizations", form.hospitalizations.trim());
      formData.append("riskAssessment", form.riskAssessment.trim());
      formData.append("freeText", form.freeText.trim());

      const result = await saveIntake(formData);

      if (result.error) {
        showToast({ message: result.error });
        setIsSubmitting(false);
        return;
      }

      showToast({ message: "אינטייק נשמר בהצלחה", durationMs: 3000 });
    } catch (error) {
      showToast({ message: "שגיאה בשמירת אינטייק" });
      console.error("Error saving intake:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="app-section">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="סיבת הפנייה">
          <input
            name="referralReason"
            value={form.referralReason}
            onChange={(e) => setForm((prev) => ({ ...prev, referralReason: e.target.value }))}
            className="app-field"
            placeholder="חובה למלא"
          />
        </Field>
        <Field label="מטרות טיפול">
          <textarea
            name="goals"
            value={form.goals}
            onChange={(e) => setForm((prev) => ({ ...prev, goals: e.target.value }))}
            className="app-textarea min-h-24"
            placeholder="חובה למלא"
          />
        </Field>
        <Field label="טיפול קודם">
          <input
            name="previousTherapy"
            value={form.previousTherapy}
            onChange={(e) => setForm((prev) => ({ ...prev, previousTherapy: e.target.value }))}
            className="app-field"
          />
        </Field>
        <Field label="טיפול תרופתי">
          <input
            name="currentMedication"
            value={form.currentMedication}
            onChange={(e) => setForm((prev) => ({ ...prev, currentMedication: e.target.value }))}
            className="app-field"
          />
        </Field>
        <Field label="אשפוזים">
          <input
            name="hospitalizations"
            value={form.hospitalizations}
            onChange={(e) => setForm((prev) => ({ ...prev, hospitalizations: e.target.value }))}
            className="app-field"
          />
        </Field>
        <Field label="הערכת סיכון">
          <textarea
            name="riskAssessment"
            value={form.riskAssessment}
            onChange={(e) => setForm((prev) => ({ ...prev, riskAssessment: e.target.value }))}
            className="app-textarea min-h-20"
          />
        </Field>
        <Field label="מלל חופשי">
          <textarea
            name="freeText"
            value={form.freeText}
            onChange={(e) => setForm((prev) => ({ ...prev, freeText: e.target.value }))}
            className="app-textarea min-h-24"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Link href={`/patients/${patientId}`} className="app-btn app-btn-secondary">
            חזרה למטופל
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="app-btn app-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "שומר..." : "שמירה"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <div className="text-xs text-muted">{label}</div>
      {children}
    </label>
  );
}
