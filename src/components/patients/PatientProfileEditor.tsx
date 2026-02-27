"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useQuickActions } from "@/components/QuickActions";

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  fixedSessionDay: string;
  fixedSessionTime: string;
  defaultSessionFeeNis: string;
  avatarKey: string;
};

export function PatientProfileEditor({
  patientId,
  initial,
  showArchive = true,
  startEditing = false,
  collapsible = false,
  initiallyCollapsed = false,
  showAvatarField = true,
}: {
  patientId: string;
  initial: FormState;
  showArchive?: boolean;
  startEditing?: boolean;
  collapsible?: boolean;
  initiallyCollapsed?: boolean;
  showAvatarField?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [editing, setEditing] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(collapsible ? initiallyCollapsed && !startEditing : false);
  const [form, setForm] = useState<FormState>(initial);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/patients/${patientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        fixedSessionDay: form.fixedSessionDay === "" ? "" : Number(form.fixedSessionDay),
        defaultSessionFeeNis:
          form.defaultSessionFeeNis === "" ? "" : Number(form.defaultSessionFeeNis),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      showToast({ message: "שמירת שינויים נכשלה." });
      return;
    }

    // Check if fixedSessionDay or fixedSessionTime changed and trigger auto-generation
    const fixedSessionDayChanged = form.fixedSessionDay !== initial.fixedSessionDay;
    const fixedSessionTimeChanged = form.fixedSessionTime !== initial.fixedSessionTime;
    const hasValidSchedule = form.fixedSessionDay !== "" && form.fixedSessionTime !== "";

    if ((fixedSessionDayChanged || fixedSessionTimeChanged) && hasValidSchedule) {
      try {
        await fetch("/api/sessions/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId }),
        });
        showToast({
          message: "פרטי המטופל נשמרו וטיפולים קבועים נוצרו",
          durationMs: 4000,
        });
      } catch (error) {
        console.error("Error generating recurring sessions:", error);
        showToast({ message: "פרטי המטופל נשמרו אך הטיפולים לא נוצרו" });
      }
    } else {
      showToast({ message: "פרטי המטופל נשמרו בהצלחה" });
    }

    setEditing(false);
    router.refresh();
  }

  async function archivePatient() {
    setArchiving(true);
    const res = await fetch(`/api/patients/${patientId}`, { method: "DELETE" });
    setArchiving(false);
    if (!res.ok) {
      showToast({ message: "העברה לארכיון נכשלה." });
      return;
    }
    showToast({ message: "המטופל הועבר לארכיון" });
    setArchiveOpen(false);
    router.push("/patients");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">פרטי מטופל</h2>
        <div className="flex items-center gap-2">
          {collapsible ? (
            <button
              type="button"
              className="app-btn app-btn-secondary text-xs"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((prev) => !prev)}
            >
              {collapsed ? "הצג פרטים" : "צמצם"}
            </button>
          ) : null}
          {!editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                if (collapsible) setCollapsed(false);
              }}
              className="app-btn app-btn-secondary"
            >
              עריכה
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="app-btn app-btn-primary disabled:opacity-50"
            >
              שמור
            </button>
          )}
          {showArchive ? (
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className="app-btn app-btn-secondary text-muted hover:bg-black/[0.03]"
            >
              ארכיון
            </button>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
      <div className="grid gap-2 text-sm">
        <LabeledField label="שם פרטי">
          <input
            disabled={!editing}
            value={form.firstName}
            onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            className="app-field disabled:bg-black/[0.03]"
          />
        </LabeledField>
        <LabeledField label="שם משפחה">
          <input
            disabled={!editing}
            value={form.lastName}
            onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
            className="app-field disabled:bg-black/[0.03]"
          />
        </LabeledField>
        <LabeledField label="טלפון">
          <input
            disabled={!editing}
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            className="app-field disabled:bg-black/[0.03]"
          />
        </LabeledField>
        <LabeledField label="אימייל">
          <input
            disabled={!editing}
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className="app-field disabled:bg-black/[0.03]"
          />
        </LabeledField>
        <LabeledField label="מגדר">
          <select
            disabled={!editing}
            value={form.gender}
            onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value as FormState["gender"] }))}
            className="app-select disabled:bg-black/[0.03]"
          >
            <option value="MALE">גבר</option>
            <option value="FEMALE">אישה</option>
            <option value="OTHER">אחר</option>
          </select>
        </LabeledField>
        <LabeledField label="תאריך לידה">
          <input
            disabled={!editing}
            type="date"
            lang="he-IL"
            value={form.dateOfBirth}
            onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
            className="app-field disabled:bg-black/[0.03]"
          />
        </LabeledField>
        <LabeledField label="יום פגישה קבוע">
          <select
            disabled={!editing}
            value={form.fixedSessionDay}
            onChange={(e) => setForm((prev) => ({ ...prev, fixedSessionDay: e.target.value }))}
            className="app-select disabled:bg-black/[0.03]"
          >
            <option value="">לא הוגדר</option>
            <option value="1">יום ראשון</option>
            <option value="2">יום שני</option>
            <option value="3">יום שלישי</option>
            <option value="4">יום רביעי</option>
            <option value="5">יום חמישי</option>
            <option value="6">יום שישי</option>
            <option value="0">שבת</option>
          </select>
        </LabeledField>
        <LabeledField label="שעת פגישה קבועה">
          <input
            disabled={!editing}
            type="time"
            step={300}
            value={form.fixedSessionTime}
            onChange={(e) => setForm((prev) => ({ ...prev, fixedSessionTime: e.target.value }))}
            className="app-field disabled:bg-black/[0.03]"
          />
        </LabeledField>
        <LabeledField label="מחיר טיפול קבוע (₪)">
          <input
            disabled={!editing}
            type="number"
            min="0"
            value={form.defaultSessionFeeNis}
            onChange={(e) => setForm((prev) => ({ ...prev, defaultSessionFeeNis: e.target.value }))}
            className="app-field disabled:bg-black/[0.03]"
          />
        </LabeledField>
        {showAvatarField ? (
          <LabeledField label="אייקון מטופל">
            <input
              disabled
              value={form.avatarKey || "ברירת מחדל"}
              className="app-field disabled:bg-black/[0.03]"
            />
          </LabeledField>
        ) : null}
      </div>
      ) : null}

      <ConfirmDialog
        open={archiveOpen}
        title="להעביר מטופל לארכיון?"
        message="ניתן לצפות בו אחר כך דרך דף מטופלי הארכיון."
        confirmLabel="העבר לארכיון"
        cancelLabel="ביטול"
        busy={archiving}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => {
          void archivePatient();
        }}
      />
    </section>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <div className="text-xs text-muted">{label}</div>
      {children}
    </label>
  );
}
