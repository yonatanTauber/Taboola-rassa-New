"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useQuickActions } from "@/components/QuickActions";
import { NoteTagsPicker, type LinkableEntity, type LinkableCategories } from "./NoteTagsPicker";
import { addDocumentAnnotation, updateDocumentAnnotation } from "@/app/research/[id]/actions";
import type { Annotation } from "./AnnotationCard";

function reverseMapTargetType(prismaType: string): string | null {
  switch (prismaType) {
    case "PATIENT":
      return "patient";
    case "SESSION":
      return "session";
    case "TASK":
      return "task";
    case "RECEIPT":
      return "receipt";
    case "RESEARCH_DOCUMENT":
      return "research-document";
    case "RESEARCH_NOTE":
      return "research-note";
    case "OTHER":
      return "topic";
    default:
      return null;
  }
}

export function AnnotationDialog({
  documentId,
  categories,
  annotation,
  onClose,
}: {
  documentId: string;
  categories: LinkableCategories;
  annotation: Annotation | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const isEdit = annotation !== null;
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Initialize tags from existing annotation links (for edit mode)
  const initialTags: LinkableEntity[] = annotation
    ? annotation.links
        .filter(
          (lnk) =>
            !(lnk.targetEntityType === "RESEARCH_DOCUMENT" && lnk.targetEntityId === documentId),
        )
        .map((lnk) => {
          const entityType = reverseMapTargetType(lnk.targetEntityType);
          return entityType
            ? {
                entityType,
                entityId: lnk.targetEntityId,
                label: lnk.targetEntityAlias ?? lnk.targetEntityId,
              }
            : null;
        })
        .filter((t): t is LinkableEntity => t !== null)
    : [];

  const [tags, setTags] = useState<LinkableEntity[]>(initialTags);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleSubmit(formData: FormData) {
    formData.set(
      "tags",
      JSON.stringify(tags.map(({ entityType, entityId, label }) => ({ entityType, entityId, label }))),
    );
    setPending(true);
    try {
      if (isEdit) {
        formData.set("annotationId", annotation.id);
        await updateDocumentAnnotation(formData);
      } else {
        await addDocumentAnnotation(formData);
      }
      onClose();
    } finally {
      setPending(false);
    }
  }

  async function deleteNote() {
    if (!annotation) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/research-notes/${annotation.id}`, { method: "DELETE" });
      if (!res.ok) {
        let message = "מחיקת הפתק נכשלה";
        try {
          const payload = (await res.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {}
        showToast({ message });
        return;
      }
      setDeleteOpen(false);
      onClose();
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-[min(92vw,560px)] animate-[modal-pop_180ms_ease-out] rounded-2xl border border-black/10 bg-white p-5 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md border border-black/10 px-2 py-1 text-xs text-muted transition hover:bg-accent-soft"
        >
          סגור
        </button>

        <h3 className="mb-4 text-lg font-semibold text-ink">
          {isEdit ? "עריכת הערה" : "הערה חדשה"}
        </h3>

        <form ref={formRef} action={handleSubmit} className="max-h-[72vh] space-y-3 overflow-auto text-sm">
          <input type="hidden" name="documentId" value={documentId} />

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">כותרת</span>
            <input
              name="title"
              autoComplete="off"
              required
              defaultValue={annotation?.title ?? ""}
              placeholder="כותרת ההערה…"
              className="app-field"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">הערה</span>
            <textarea
              name="note"
              autoComplete="off"
              defaultValue={annotation?.markdown ?? ""}
              placeholder="תוכן ההערה, קישור חשיבה…"
              className="app-textarea min-h-32"
            />
          </label>

          <NoteTagsPicker categories={categories} value={tags} onChange={setTags} />

          <div className="flex justify-end gap-2 pt-1">
            {isEdit ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="app-btn app-btn-secondary me-auto text-danger"
                disabled={pending}
              >
                מחק פתק
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="app-btn app-btn-secondary">
              ביטול
            </button>
            <button type="submit" className="app-btn app-btn-primary" disabled={pending}>
              {pending ? "שומר…" : isEdit ? "עדכן" : "שמור"}
            </button>
          </div>
        </form>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        title="מחיקת פתק"
        message="האם למחוק את הפתק לצמיתות?\nלא ניתן לשחזר אחרי המחיקה."
        confirmLabel="מחק פתק"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={deleteNote}
        busy={deleting}
      />
    </div>
  );
}
