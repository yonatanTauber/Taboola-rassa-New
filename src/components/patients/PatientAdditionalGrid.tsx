"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EntityLink } from "@/components/EntityLink";
import { PatientProfileEditor } from "@/components/patients/PatientProfileEditor";
import { useQuickActions } from "@/components/QuickActions";

type FigureRow = { id: string; name: string };
type ConceptLinkRow = { id: string; label: string; href: string | null };
type LinkedResearchNoteRow = {
  id: string;
  title: string;
  markdown: string;
  documentId: string | null;
  documentTitle: string | null;
};
type NoteRow = { id: string; title: string; content: string };
type GuidanceRow = { id: string; title: string; scheduledAt: string | null; instructorName: string | null };

type ActiveNote = {
  kind: "research" | "patient";
  id: string;
  title: string;
  content: string;
  documentId?: string | null;
  documentTitle?: string | null;
};

type ProfileInitial = {
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

export function PatientAdditionalGrid({
  patientId,
  startEditingProfile,
  profileInitial,
  goals,
  referralReason,
  previousTherapy,
  currentMedication,
  hospitalizations,
  figures,
  conceptLinks,
  linkedResearchNotes = [],
  guidances = [],
  notes,
}: {
  patientId: string;
  startEditingProfile: boolean;
  profileInitial: ProfileInitial;
  goals: string | null;
  referralReason: string | null;
  previousTherapy: string | null;
  currentMedication: string | null;
  hospitalizations: string | null;
  figures: FigureRow[];
  conceptLinks: ConceptLinkRow[];
  linkedResearchNotes?: LinkedResearchNoteRow[];
  guidances?: GuidanceRow[];
  notes: NoteRow[];
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<ActiveNote | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState<{ title: string; content: string }>({ title: "", content: "" });
  const [noteDeleteOpen, setNoteDeleteOpen] = useState(false);
  const [conceptDeleteTarget, setConceptDeleteTarget] = useState<ConceptLinkRow | null>(null);

  function openNote(note: ActiveNote) {
    setActiveNote(note);
    setNoteDraft({ title: note.title, content: note.content });
  }

  async function handleDeleteActiveNote() {
    if (!activeNote) return;
    const key = `${activeNote.kind}:${activeNote.id}`;
    setDeletingKey(key);
    try {
      const endpoint =
        activeNote.kind === "research"
          ? `/api/research-notes/${activeNote.id}`
          : `/api/patient-notes/${activeNote.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const payload = await safeJson(res);
        throw new Error(payload?.error ?? "מחיקה נכשלה");
      }
      setNoteDeleteOpen(false);
      setActiveNote(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "מחיקה נכשלה";
      showToast({ message: `מחיקת הפתק נכשלה: ${message}` });
    } finally {
      setDeletingKey((prev) => (prev === key ? null : prev));
    }
  }

  async function saveActiveNote() {
    if (!activeNote) return;
    if (!noteDraft.title.trim()) {
      showToast({ message: "חובה להזין כותרת." });
      return;
    }
    setSavingNote(true);
    try {
      const endpoint =
        activeNote.kind === "research"
          ? `/api/research-notes/${activeNote.id}`
          : `/api/patient-notes/${activeNote.id}`;
      const body =
        activeNote.kind === "research"
          ? { title: noteDraft.title.trim(), markdown: noteDraft.content }
          : { title: noteDraft.title.trim(), content: noteDraft.content };

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await safeJson(res);
        throw new Error(payload?.error ?? "שמירה נכשלה");
      }
      setActiveNote((prev) =>
        prev
          ? {
              ...prev,
              title: noteDraft.title.trim(),
              content: noteDraft.content,
            }
          : prev,
      );
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "שמירה נכשלה";
      showToast({ message: `שמירת הפתק נכשלה: ${message}` });
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteConceptLink() {
    if (!conceptDeleteTarget) return;
    const key = `concept:${conceptDeleteTarget.id}`;
    setDeletingKey(key);
    try {
      const res = await fetch(`/api/patient-concept-links/${conceptDeleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await safeJson(res);
        throw new Error(payload?.error ?? "מחיקה נכשלה");
      }
      setConceptDeleteTarget(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "מחיקה נכשלה";
      showToast({ message: `מחיקת הקישור נכשלה: ${message}` });
    } finally {
      setDeletingKey((prev) => (prev === key ? null : prev));
    }
  }

  return (
    <div className="space-y-4">
      <section className="app-section border-black/18">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">מידע קליני</h2>
          <Link href={`/patients/${patientId}/intake`} className="app-btn app-btn-secondary text-xs">
            מעבר לאינטייק
          </Link>
        </div>

        <PatientProfileEditor
          patientId={patientId}
          showArchive={false}
          startEditing={startEditingProfile}
          collapsible
          initiallyCollapsed={!startEditingProfile}
          showAvatarField={false}
          initial={profileInitial}
        />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoCard title="מטרות הטיפול" text={goals ?? "—"} />
          <InfoCard title="סיבת הפנייה" text={referralReason ?? "—"} />
          <InfoCard title="טיפול קודם" text={previousTherapy ?? "—"} />
          <InfoCard title="רקע רפואי/אשפוזים" text={`תרופות: ${currentMedication ?? "—"}\nאשפוזים: ${hospitalizations ?? "—"}`} />
        </div>
      </section>

      <section className="app-section border-black/18">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">קשרים ותוכן</h2>
          <Link href="/research" className="app-btn app-btn-secondary text-xs">
            מעבר למחקר
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Block title="הדרכות מקושרות">
            {guidances.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {guidances.slice(0, 10).map((guidance) => (
                  <li key={guidance.id}>
                    <EntityLink
                      type="guidance"
                      id={guidance.id}
                      label={`${guidance.title}${guidance.scheduledAt ? ` · ${new Date(guidance.scheduledAt).toLocaleDateString("he-IL")}` : ""}${guidance.instructorName ? ` · ${guidance.instructorName}` : ""}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">אין הדרכות מקושרות</p>
            )}
          </Block>

          <Block title="דמויות">
            {figures.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {figures.slice(0, 12).map((figure) => (
                  <li key={figure.id} className="text-ink">{figure.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">אין דמויות מקושרות</p>
            )}
          </Block>

          <Block title="פתקים ומחשבות">
            {linkedResearchNotes.length > 0 || notes.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {linkedResearchNotes.slice(0, 8).map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() =>
                        openNote({
                          kind: "research",
                          id: note.id,
                          title: note.title,
                          content: note.markdown,
                          documentId: note.documentId,
                          documentTitle: note.documentTitle,
                        })
                      }
                      className="flex w-full items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-right transition hover:bg-black/[0.02]"
                    >
                      <span className="min-w-0 flex-1 truncate text-accent">{note.title}</span>
                      <span className="text-xs text-muted">פתח</span>
                    </button>
                  </li>
                ))}
                {notes.slice(0, 8).map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => openNote({ kind: "patient", id: note.id, title: note.title, content: note.content })}
                      className="flex w-full items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-right transition hover:bg-black/[0.02]"
                    >
                      <span className="min-w-0 flex-1 truncate text-accent">{note.title}</span>
                      <span className="text-xs text-muted">פתח</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">אין פתקים/מחשבות מקושרים</p>
            )}
          </Block>

          <Block title="מקורות וקישורים חיצוניים">
            {conceptLinks.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {conceptLinks.map((link) => (
                  <li key={link.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      {link.href ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent transition hover:underline"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <span className="text-ink">{link.label}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setConceptDeleteTarget(link)}
                      disabled={deletingKey === `concept:${link.id}`}
                      className="app-btn app-btn-secondary !px-2 !py-1 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingKey === `concept:${link.id}` ? "מוחק…" : "מחק"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">אין מקורות חיצוניים מקושרים</p>
            )}
          </Block>
        </div>
      </section>

      {activeNote ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-3"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveNote(null);
          }}
        >
          <div role="dialog" aria-modal="true" className="w-[min(92vw,52rem)] rounded-2xl border border-black/16 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-3xl font-semibold text-ink">עריכת הערה</h3>
              <button type="button" className="app-btn app-btn-secondary" onClick={() => setActiveNote(null)} disabled={savingNote}>
                סגור
              </button>
            </div>

            <div className="space-y-3">
              {activeNote.kind === "research" ? (
                <div className="text-sm text-muted">
                  {activeNote.documentId ? (
                    <a href={`/research/${activeNote.documentId}`} className="text-accent hover:underline">
                      {activeNote.documentTitle ? `פתח מקור: ${activeNote.documentTitle}` : "פתח מקור במחקר"}
                    </a>
                  ) : (
                    "פתק מחקר ללא מקור מקושר"
                  )}
                </div>
              ) : null}

              <label className="block space-y-1">
                <span className="text-sm text-muted">כותרת</span>
                <input
                  value={noteDraft.title}
                  onChange={(e) => setNoteDraft((prev) => ({ ...prev, title: e.target.value }))}
                  className="app-field"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm text-muted">הערה</span>
                <textarea
                  value={noteDraft.content}
                  onChange={(e) => setNoteDraft((prev) => ({ ...prev, content: e.target.value }))}
                  className="app-textarea min-h-44"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="app-btn app-btn-secondary text-danger"
                onClick={() => setNoteDeleteOpen(true)}
                disabled={savingNote || deletingKey === `${activeNote.kind}:${activeNote.id}`}
              >
                {deletingKey === `${activeNote.kind}:${activeNote.id}` ? "מוחק..." : "מחק פתק"}
              </button>
              <div className="flex items-center gap-2">
                <button type="button" className="app-btn app-btn-secondary" onClick={() => setActiveNote(null)} disabled={savingNote}>
                  ביטול
                </button>
                <button type="button" className="app-btn app-btn-primary" onClick={saveActiveNote} disabled={savingNote}>
                  {savingNote ? "מעדכן..." : "עדכן"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={noteDeleteOpen}
        title="מחיקת פתק"
        message="האם למחוק את הפתק לצמיתות?\nלא ניתן לשחזר אחרי המחיקה."
        confirmLabel="מחק פתק"
        onCancel={() => setNoteDeleteOpen(false)}
        onConfirm={handleDeleteActiveNote}
        busy={activeNote ? deletingKey === `${activeNote.kind}:${activeNote.id}` : false}
      />

      <ConfirmDialog
        open={!!conceptDeleteTarget}
        title="מחיקת קישור"
        message={`האם למחוק את הקישור "${conceptDeleteTarget?.label ?? ""}"?\nלא ניתן לשחזר אחרי המחיקה.`}
        confirmLabel="מחק קישור"
        onCancel={() => setConceptDeleteTarget(null)}
        onConfirm={handleDeleteConceptLink}
        busy={conceptDeleteTarget ? deletingKey === `concept:${conceptDeleteTarget.id}` : false}
      />
    </div>
  );
}

async function safeJson(res: Response) {
  try {
    return (await res.json()) as { error?: string };
  } catch {
    return null;
  }
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-xl border border-black/12 bg-white/90 p-3">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>
    </article>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-black/12 bg-white/90 p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
