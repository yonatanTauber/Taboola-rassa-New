"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useQuickActions } from "@/components/QuickActions";

export function PatientNoteEditor({
  noteId,
  initialTitle,
  initialContent,
  patientId,
}: {
  noteId: string;
  initialTitle: string;
  initialContent: string;
  patientId: string;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      showToast({ message: "חובה להזין כותרת." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/patient-notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null) as { error?: string } | null;
        showToast({ message: p?.error ?? "שמירה נכשלה." });
        return;
      }
      showToast({ message: "הפתק נשמר" });
      setIsDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/patient-notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) {
        const p = await res.json().catch(() => null) as { error?: string } | null;
        showToast({ message: p?.error ?? "מחיקה נכשלה." });
        return;
      }
      showToast({ message: "הפתק נמחק" });
      router.push(`/patients/${patientId}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="app-section space-y-4">
      {/* Title */}
      <label className="block space-y-1">
        <span className="text-sm font-medium text-muted">כותרת</span>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
          className="app-field text-lg font-semibold"
          placeholder="כותרת הפתק..."
        />
      </label>

      {/* Content */}
      <label className="block space-y-1">
        <span className="text-sm font-medium text-muted">תוכן</span>
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setIsDirty(true); }}
          className="app-textarea min-h-[16rem] font-mono text-sm leading-relaxed"
          placeholder="כתוב את הפתק כאן..."
        />
      </label>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/8 pt-3">
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          disabled={saving || deleting}
          className="app-btn app-btn-secondary text-danger"
        >
          {deleting ? "מוחק..." : "מחק פתק"}
        </button>

        <div className="flex items-center gap-2">
          {isDirty && <span className="text-xs text-muted">יש שינויים שלא נשמרו</span>}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            className="app-btn app-btn-primary disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="מחיקת פתק"
        message="האם למחוק את הפתק לצמיתות?\nלא ניתן לשחזר אחרי המחיקה."
        confirmLabel="מחק פתק"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        busy={deleting}
      />
    </div>
  );
}
