"use client";

import { useState } from "react";
import { AnnotationCard, type Annotation } from "./AnnotationCard";
import { AnnotationDialog } from "./AnnotationDialog";
import type { LinkableCategories } from "./NoteTagsPicker";

export function AnnotationsSidebar({
  documentId,
  annotations,
  categories,
}: {
  documentId: string;
  annotations: Annotation[];
  categories: LinkableCategories;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted">הערות על הפריט</h2>
        <button
          type="button"
          onClick={() => {
            setEditingAnnotation(null);
            setDialogOpen(true);
          }}
          className="app-btn app-btn-primary !py-1 !px-3 text-xs"
        >
          + הערה חדשה
        </button>
      </div>

      <ul className="space-y-2">
        {annotations.map((note) => (
          <AnnotationCard
            key={note.id}
            annotation={note}
            documentId={documentId}
            onEdit={() => {
              setEditingAnnotation(note);
              setDialogOpen(true);
            }}
          />
        ))}
        {annotations.length === 0 ? (
          <li className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-center text-sm text-muted">
            אין הערות עדיין. לחץ &quot;+ הערה חדשה&quot; כדי להתחיל.
          </li>
        ) : null}
      </ul>

      {dialogOpen ? (
        <AnnotationDialog
          documentId={documentId}
          categories={categories}
          annotation={editingAnnotation}
          onClose={() => {
            setDialogOpen(false);
            setEditingAnnotation(null);
          }}
        />
      ) : null}
    </div>
  );
}
