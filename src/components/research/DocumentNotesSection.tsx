"use client";

import { useState, useRef } from "react";
import { EntityLink } from "@/components/EntityLink";
import { NoteTagsPicker, type LinkableEntity, type LinkableCategories } from "./NoteTagsPicker";
import { addDocumentAnnotation } from "@/app/research/[id]/actions";
import type { EntityType } from "@/lib/entity-config";

type AnnotationLink = {
  id: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityAlias: string | null;
};

type Annotation = {
  id: string;
  title: string;
  markdown: string;
  links: AnnotationLink[];
};

function targetTypeToEntityType(targetType: string): EntityType | null {
  switch (targetType) {
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
    default:
      return null;
  }
}

export function DocumentNotesSection({
  documentId,
  annotations,
  title,
  categories,
}: {
  documentId: string;
  annotations: Annotation[];
  title: string;
  categories: LinkableCategories;
}) {
  const [tags, setTags] = useState<LinkableEntity[]>([]);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    // Inject tags JSON into the formData
    formData.set("tags", JSON.stringify(tags.map(({ entityType, entityId, label }) => ({ entityType, entityId, label }))));
    setPending(true);
    try {
      await addDocumentAnnotation(formData);
      setTags([]);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="app-section">
        <h2 className="mb-2 text-lg font-semibold">{title}</h2>
        <form ref={formRef} action={handleSubmit} className="space-y-2 text-sm">
          <input type="hidden" name="documentId" value={documentId} />
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">כותרת הערה</span>
            <input
              name="title"
              autoComplete="off"
              required
              placeholder="כותרת הערה… לדוגמה: קשר להדרכה"
              className="app-field"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">ציטוט/קטע שסימנת</span>
            <textarea
              name="excerpt"
              autoComplete="off"
              placeholder="ציטוט/קטע שסימנת… לדוגמה: ציטוט מרכזי"
              className="app-textarea min-h-24"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">הערה/קישור חשיבה</span>
            <textarea
              name="note"
              autoComplete="off"
              placeholder="הערה/קישור חשיבה… לדוגמה: השוואה למקרה"
              className="app-textarea min-h-32"
            />
          </label>

          <NoteTagsPicker categories={categories} value={tags} onChange={setTags} />

          <button className="app-btn app-btn-primary" disabled={pending}>
            {pending ? "שומר…" : "שמור"}
          </button>
        </form>
      </section>

      <section className="app-section">
        <h3 className="mb-2 text-sm font-semibold text-muted">הערות על הפריט</h3>
        <ul className="space-y-2 text-sm">
          {annotations.map((note) => {
            // Filter out the link to this document (it's implicit)
            const extraLinks = note.links.filter(
              (lnk) =>
                !(lnk.targetEntityType === "RESEARCH_DOCUMENT" && lnk.targetEntityId === documentId),
            );

            return (
              <li key={note.id} className="rounded-lg border border-black/20 px-3 py-2">
                <div className="font-medium">{note.title}</div>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-muted">{note.markdown}</pre>
                {extraLinks.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {extraLinks.map((lnk) => {
                      const entityType = targetTypeToEntityType(lnk.targetEntityType);
                      if (!entityType) {
                        // For OTHER (topics), show a small plain chip
                        return (
                          <span
                            key={lnk.id}
                            className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600"
                          >
                            {lnk.targetEntityAlias ?? lnk.targetEntityId}
                          </span>
                        );
                      }
                      return (
                        <EntityLink
                          key={lnk.id}
                          type={entityType}
                          id={lnk.targetEntityId}
                          label={lnk.targetEntityAlias ?? entityType}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
          {annotations.length === 0 ? <li className="text-muted">אין הערות עדיין.</li> : null}
        </ul>
      </section>
    </div>
  );
}
