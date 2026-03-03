"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useQuickActions } from "@/components/QuickActions";
import { CustomSelect } from "@/components/CustomSelect";

const FIGURE_ROLE_LABELS: Record<string, string> = {
  MOTHER: "אמא",
  FATHER: "אבא",
  SISTER: "אחות",
  BROTHER: "אח",
  PARTNER: "בן/בת זוג",
  FRIEND: "חבר/ה",
  COLLEAGUE: "עמית",
  ACQUAINTANCE: "מכר",
  OTHER: "אחר",
};

const SESSION_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "מתוכנן",
  COMPLETED: "הושלם",
  CANCELED: "בוטל",
  CANCELED_LATE: "בוטל באיחור",
  NO_SHOW: "לא הגיע",
};

type Appearance = {
  sessionId: string;
  scheduledAt: string;
  status: string;
  markdown: string;
};

/** Highlight all occurrences of `figureName` in `text` with a <mark> element. */
function highlightName(text: string, figureName: string): React.ReactNode[] {
  if (!figureName.trim()) return [text];
  const escaped = figureName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5 font-bold not-italic">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function FigurePageClient({
  figureId,
  initialName,
  initialRole,
  initialNotes,
  patientId,
  appearances,
}: {
  figureId: string;
  initialName: string;
  initialRole: string;
  initialNotes: string;
  patientId: string;
  appearances: Appearance[];
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();

  const [name, setName] = useState(initialName);
  const [role, setRole] = useState(initialRole);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function markDirty() {
    setIsDirty(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      showToast({ message: "חובה להזין שם." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/figures/${figureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role, notes }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null) as { error?: string } | null;
        showToast({ message: p?.error ?? "שמירה נכשלה." });
        return;
      }
      showToast({ message: "הדמות נשמרה" });
      setIsDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/figures/${figureId}`, { method: "DELETE" });
      if (!res.ok) {
        const p = await res.json().catch(() => null) as { error?: string } | null;
        showToast({ message: p?.error ?? "מחיקה נכשלה." });
        return;
      }
      showToast({ message: "הדמות נמחקה" });
      router.push(`/patients/${patientId}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Edit form */}
      <section className="app-section space-y-4">
        <h2 className="text-base font-semibold">פרטי הדמות</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-muted">שם</span>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              className="app-field"
              placeholder="שם הדמות..."
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-muted">קשר</span>
            <CustomSelect
              value={role}
              onChange={(v) => { setRole(v); markDirty(); }}
              options={Object.entries(FIGURE_ROLE_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))}
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-muted">הערות</span>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); markDirty(); }}
            className="app-textarea min-h-[8rem]"
            placeholder="הוסף הערות על הדמות..."
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
            {deleting ? "מוחק..." : "מחק דמות"}
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
      </section>

      {/* Appearances in sessions */}
      <section className="app-section">
        <h2 className="mb-3 text-base font-semibold">
          הופעות בתיעוד סשנים
          {appearances.length > 0 && (
            <span className="ms-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              {appearances.length}
            </span>
          )}
        </h2>

        {appearances.length === 0 ? (
          <p className="text-sm text-muted">הדמות לא מוזכרת בתיעוד סשנים</p>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {appearances.map((a) => {
              const isExpanded = expandedId === a.sessionId;
              return (
                <li key={a.sessionId}>
                  {/* Clickable header row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : a.sessionId)}
                    className="flex w-full items-center justify-between px-1 py-2.5 text-start transition hover:bg-accent-soft/30"
                  >
                    <span className="text-sm font-medium text-ink">
                      {new Date(a.scheduledAt).toLocaleDateString("he-IL", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-muted">
                        {SESSION_STATUS_LABELS[a.status] ?? a.status}
                      </span>
                      <span className="text-xs text-muted" aria-hidden="true">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {/* Expanded text with highlighted figure name */}
                  {isExpanded && (
                    <div className="rounded-lg bg-black/[0.02] px-3 pb-3 pt-2">
                      {a.markdown.trim() ? (
                        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink/80">
                          {highlightName(a.markdown, name)}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted">אין תוכן תיעוד לסשן זה.</p>
                      )}
                      <Link
                        href={`/sessions/${a.sessionId}`}
                        className="mt-2 inline-block text-xs text-accent hover:underline"
                      >
                        פתח סשן ←
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleteOpen}
        title="מחיקת דמות"
        message={`האם למחוק את הדמות "${name}"?\nלא ניתן לשחזר אחרי המחיקה.`}
        confirmLabel="מחק דמות"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        busy={deleting}
      />
    </div>
  );
}
