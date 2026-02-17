"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HebrewDateInput } from "@/components/HebrewDateInput";
import { useQuickActions } from "@/components/QuickActions";

type TaskPayload = {
  id: string;
  title: string;
  status: string;
  dueAt: string;
  patientId: string;
};

export function TaskEditor({
  task,
  patients,
}: {
  task: TaskPayload;
  patients: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();

  const [form, setForm] = useState(task);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    const previous = { ...task };
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) return;
    showToast({
      message: "המשימה עודכנה בהצלחה",
      durationMs: 5000,
      undoLabel: "↺",
      onUndo: async () => {
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(previous),
        });
        router.refresh();
      },
    });
    router.back();
    router.refresh();
  }

  async function deleteTask() {
    setDeleting(true);
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      showToast({ message: "מחיקת משימה נכשלה" });
      return;
    }
    showToast({ message: "המשימה נמחקה" });
    router.push("/tasks");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/10 bg-white p-4">
      <h2 className="text-lg font-semibold">עריכת משימה</h2>

      <textarea
        value={form.title}
        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        className="app-textarea min-h-20"
      />

      <select
        value={form.patientId}
        onChange={(e) => setForm((prev) => ({ ...prev, patientId: e.target.value }))}
        className="app-select"
      >
        <option value="">כללי לקליניקה</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <div className="grid grid-cols-1 gap-2">
        <HebrewDateInput
          value={form.dueAt}
          onChange={(next) => setForm((prev) => ({ ...prev, dueAt: next }))}
        />
      </div>
      <select
        value={form.status}
        onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
        className="app-select"
      >
        <option value="OPEN">פתוחה</option>
        <option value="DONE">בוצעה</option>
        <option value="CANCELED">בוטלה</option>
      </select>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setDeleteOpen(true)} className="app-btn app-btn-secondary text-danger" disabled={saving}>
          מחק משימה
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => router.back()} className="app-btn app-btn-secondary">ביטול</button>
          <button onClick={save} disabled={saving} className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50">עדכן</button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="מחיקת משימה"
        message="האם למחוק את המשימה לצמיתות?\nלא ניתן לשחזר אחרי המחיקה."
        confirmLabel="מחק משימה"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={deleteTask}
        busy={deleting}
      />
    </div>
  );
}
