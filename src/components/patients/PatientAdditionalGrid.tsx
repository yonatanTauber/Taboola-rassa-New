"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EntityLink } from "@/components/EntityLink";
import { PatientProfileEditor } from "@/components/patients/PatientProfileEditor";
import { useQuickActions } from "@/components/QuickActions";

type FigureRow = { id: string; name: string; role?: string };
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
type MedicalDocRow = { id: string; title: string; filePath: string };

type ActiveNote = {
  kind: "research" | "patient";
  id: string;
  title: string;
  content: string;
  documentId?: string | null;
  documentTitle?: string | null;
};

type ModalType = "guidance" | "figure" | "note" | "link" | "medicalDoc" | null;

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

const DOC_KIND_LABELS: Record<string, string> = {
  EVALUATION: "הערכה",
  TEST_RESULT: "תוצאות בדיקה",
  HOSPITAL_SUMMARY: "סיכום אשפוז",
  REFERRAL: "הפניה",
  OTHER: "אחר",
};

export function PatientAdditionalGrid({
  patientId,
  startEditingProfile,
  profileInitial,
  isInactive = false,
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
  medicalDocuments = [],
}: {
  patientId: string;
  startEditingProfile: boolean;
  profileInitial: ProfileInitial;
  isInactive?: boolean;
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
  medicalDocuments?: MedicalDocRow[];
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<ActiveNote | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState<{ title: string; content: string }>({ title: "", content: "" });
  const [noteDeleteOpen, setNoteDeleteOpen] = useState(false);
  const [conceptDeleteTarget, setConceptDeleteTarget] = useState<ConceptLinkRow | null>(null);

  // Quick-add modal
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);

  // Guidance form
  const [guidanceTitle, setGuidanceTitle] = useState("");
  // Figure form
  const [figureName, setFigureName] = useState("");
  const [figureRole, setFigureRole] = useState("OTHER");
  const [figureNotes, setFigureNotes] = useState("");
  // Note form
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  // Link form
  const [linkLabel, setLinkLabel] = useState("");
  const [linkHref, setLinkHref] = useState("");
  // Medical doc form
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docKind, setDocKind] = useState("OTHER");

  function openModalFor(type: ModalType) {
    setOpenModal(type);
  }

  function closeModal() {
    if (!saving) setOpenModal(null);
  }

  async function createGuidance() {
    setSaving(true);
    try {
      const res = await fetch("/api/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, title: guidanceTitle.trim() || "הדרכה ללא כותרת" }),
      });
      if (!res.ok) {
        const p = await safeJson(res);
        showToast({ message: p?.error ?? "יצירת הדרכה נכשלה." });
        return;
      }
      showToast({ message: "הדרכה נוצרה" });
      setGuidanceTitle("");
      setOpenModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createFigure() {
    if (!figureName.trim()) { showToast({ message: "חובה להזין שם." }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/figures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, name: figureName.trim(), role: figureRole, notes: figureNotes.trim() || undefined }),
      });
      if (!res.ok) {
        const p = await safeJson(res);
        showToast({ message: p?.error ?? "יצירת דמות נכשלה." });
        return;
      }
      showToast({ message: "דמות נוצרה" });
      setFigureName(""); setFigureRole("OTHER"); setFigureNotes("");
      setOpenModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createNote() {
    if (!noteTitle.trim()) { showToast({ message: "חובה להזין כותרת." }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/patient-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, title: noteTitle.trim(), content: noteContent }),
      });
      if (!res.ok) {
        const p = await safeJson(res);
        showToast({ message: p?.error ?? "יצירת פתק נכשלה." });
        return;
      }
      showToast({ message: "פתק נוצר" });
      setNoteTitle(""); setNoteContent("");
      setOpenModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createLink() {
    if (!linkLabel.trim()) { showToast({ message: "חובה להזין תווית." }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/patient-concept-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, label: linkLabel.trim(), href: linkHref.trim() || undefined }),
      });
      if (!res.ok) {
        const p = await safeJson(res);
        showToast({ message: p?.error ?? "יצירת קישור נכשלה." });
        return;
      }
      showToast({ message: "קישור נוצר" });
      setLinkLabel(""); setLinkHref("");
      setOpenModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createMedicalDoc() {
    if (!docTitle.trim()) { showToast({ message: "חובה להזין כותרת." }); return; }
    if (!docUrl.trim()) { showToast({ message: "חובה להזין קישור לקובץ." }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/medical-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, title: docTitle.trim(), filePath: docUrl.trim(), kind: docKind }),
      });
      if (!res.ok) {
        const p = await safeJson(res);
        showToast({ message: p?.error ?? "הוספת מסמך נכשלה." });
        return;
      }
      showToast({ message: "מסמך נוסף" });
      setDocTitle(""); setDocUrl(""); setDocKind("OTHER");
      setOpenModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

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
    if (!noteDraft.title.trim()) { showToast({ message: "חובה להזין כותרת." }); return; }
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
      setActiveNote((prev) => prev ? { ...prev, title: noteDraft.title.trim(), content: noteDraft.content } : prev);
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
      {/* ── Clinical section ── */}
      <section className="app-section border-black/18">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">מידע קליני</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openModalFor("medicalDoc")}
              className="app-btn app-btn-secondary px-2 py-1 text-xs"
            >
              + מסמך רפואי
            </button>
            <Link href={`/patients/${patientId}/intake`} className="app-btn app-btn-secondary text-xs">
              מעבר לאינטייק
            </Link>
          </div>
        </div>

        <PatientProfileEditor
          patientId={patientId}
          showArchive={false}
          startEditing={startEditingProfile}
          collapsible
          initiallyCollapsed={!startEditingProfile}
          showAvatarField={false}
          initial={profileInitial}
          isInactive={isInactive}
        />

        {medicalDocuments.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-muted">מסמכים רפואיים</h3>
            <ul className="space-y-1 text-sm">
              {medicalDocuments.map((doc) => (
                <li key={doc.id}>
                  <a href={doc.filePath} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoCard title="מטרות הטיפול" text={goals ?? "—"} />
          <InfoCard title="סיבת הפנייה" text={referralReason ?? "—"} />
          <InfoCard title="טיפול קודם" text={previousTherapy ?? "—"} />
          <InfoCard title="רקע רפואי/אשפוזים" text={`תרופות: ${currentMedication ?? "—"}\nאשפוזים: ${hospitalizations ?? "—"}`} />
        </div>
      </section>

      {/* ── Relationships & content section ── */}
      <section className="app-section border-black/18">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">קשרים ותוכן</h2>
          <Link href="/research" className="app-btn app-btn-secondary text-xs">
            מעבר למחקר
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Guidance block */}
          <BlockWithAdd title="הדרכות מקושרות" onAdd={() => openModalFor("guidance")}>
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
          </BlockWithAdd>

          {/* Figures block */}
          <BlockWithAdd title="דמויות" onAdd={() => openModalFor("figure")}>
            {figures.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {figures.slice(0, 12).map((figure) => (
                  <li key={figure.id} className="flex items-center gap-2">
                    <span className="text-ink">{figure.name}</span>
                    {figure.role && figure.role !== "OTHER" && (
                      <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] text-muted">
                        {FIGURE_ROLE_LABELS[figure.role] ?? figure.role}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">אין דמויות מקושרות</p>
            )}
          </BlockWithAdd>

          {/* Notes block */}
          <BlockWithAdd title="פתקים ומחשבות" onAdd={() => openModalFor("note")}>
            {linkedResearchNotes.length > 0 || notes.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {linkedResearchNotes.slice(0, 8).map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => openNote({ kind: "research", id: note.id, title: note.title, content: note.markdown, documentId: note.documentId, documentTitle: note.documentTitle })}
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
          </BlockWithAdd>

          {/* External links block */}
          <BlockWithAdd title="מקורות וקישורים חיצוניים" onAdd={() => openModalFor("link")}>
            {conceptLinks.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {conceptLinks.map((link) => (
                  <li key={link.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      {link.href ? (
                        <a href={link.href} target="_blank" rel="noreferrer" className="text-accent transition hover:underline">
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
          </BlockWithAdd>
        </div>
      </section>

      {/* ── Quick-add modals ── */}
      {openModal ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 px-4 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">

            {/* ── Guidance ── */}
            {openModal === "guidance" && (
              <>
                <h3 className="mb-4 text-lg font-semibold">הדרכה חדשה</h3>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">כותרת הדרכה</span>
                    <input
                      autoFocus
                      value={guidanceTitle}
                      onChange={(e) => setGuidanceTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void createGuidance(); }}
                      className="app-field"
                      placeholder="הזן כותרת (אופציונלי)..."
                    />
                  </label>
                  <p className="text-xs text-muted">ההדרכה תקושר אוטומטית למטופל. תוכל להשלים פרטים נוספים בדף ההדרכה.</p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={closeModal} disabled={saving} className="app-btn app-btn-secondary">ביטול</button>
                  <button type="button" onClick={() => void createGuidance()} disabled={saving} className="app-btn app-btn-primary disabled:opacity-50">
                    {saving ? "יוצר..." : "צור הדרכה"}
                  </button>
                </div>
              </>
            )}

            {/* ── Figure ── */}
            {openModal === "figure" && (
              <>
                <h3 className="mb-4 text-lg font-semibold">דמות חדשה</h3>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">שם</span>
                    <input
                      autoFocus
                      value={figureName}
                      onChange={(e) => setFigureName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void createFigure(); }}
                      className="app-field"
                      placeholder="שם הדמות..."
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">קשר</span>
                    <select value={figureRole} onChange={(e) => setFigureRole(e.target.value)} className="app-select">
                      {Object.entries(FIGURE_ROLE_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">הערות (אופציונלי)</span>
                    <textarea value={figureNotes} onChange={(e) => setFigureNotes(e.target.value)} className="app-textarea min-h-16" placeholder="הוסף הערות..." />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={closeModal} disabled={saving} className="app-btn app-btn-secondary">ביטול</button>
                  <button type="button" onClick={() => void createFigure()} disabled={saving || !figureName.trim()} className="app-btn app-btn-primary disabled:opacity-50">
                    {saving ? "יוצר..." : "צור דמות"}
                  </button>
                </div>
              </>
            )}

            {/* ── Note ── */}
            {openModal === "note" && (
              <>
                <h3 className="mb-4 text-lg font-semibold">פתק חדש</h3>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">כותרת</span>
                    <input autoFocus value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className="app-field" placeholder="כותרת הפתק..." />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">תוכן</span>
                    <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} className="app-textarea min-h-24" placeholder="תוכן הפתק..." />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={closeModal} disabled={saving} className="app-btn app-btn-secondary">ביטול</button>
                  <button type="button" onClick={() => void createNote()} disabled={saving || !noteTitle.trim()} className="app-btn app-btn-primary disabled:opacity-50">
                    {saving ? "יוצר..." : "צור פתק"}
                  </button>
                </div>
              </>
            )}

            {/* ── External link ── */}
            {openModal === "link" && (
              <>
                <h3 className="mb-4 text-lg font-semibold">קישור חדש</h3>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">תווית / שם</span>
                    <input
                      autoFocus
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void createLink(); }}
                      className="app-field"
                      placeholder="שם הקישור..."
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">כתובת URL (אופציונלי)</span>
                    <input type="url" value={linkHref} onChange={(e) => setLinkHref(e.target.value)} className="app-field" placeholder="https://..." />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={closeModal} disabled={saving} className="app-btn app-btn-secondary">ביטול</button>
                  <button type="button" onClick={() => void createLink()} disabled={saving || !linkLabel.trim()} className="app-btn app-btn-primary disabled:opacity-50">
                    {saving ? "יוצר..." : "צור קישור"}
                  </button>
                </div>
              </>
            )}

            {/* ── Medical document ── */}
            {openModal === "medicalDoc" && (
              <>
                <h3 className="mb-4 text-lg font-semibold">מסמך רפואי חדש</h3>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">כותרת</span>
                    <input autoFocus value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="app-field" placeholder="שם המסמך..." />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">סוג מסמך</span>
                    <select value={docKind} onChange={(e) => setDocKind(e.target.value)} className="app-select">
                      {Object.entries(DOC_KIND_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">קישור לקובץ / URL</span>
                    <input type="url" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} className="app-field" placeholder="https://..." />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={closeModal} disabled={saving} className="app-btn app-btn-secondary">ביטול</button>
                  <button type="button" onClick={() => void createMedicalDoc()} disabled={saving || !docTitle.trim() || !docUrl.trim()} className="app-btn app-btn-primary disabled:opacity-50">
                    {saving ? "שומר..." : "הוסף מסמך"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Note editor modal ── */}
      {activeNote ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-3"
          onClick={(e) => { if (e.target === e.currentTarget) setActiveNote(null); }}
        >
          <div role="dialog" aria-modal="true" className="w-[min(92vw,52rem)] rounded-2xl border border-black/16 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-3xl font-semibold text-ink">עריכת הערה</h3>
              <button type="button" className="app-btn app-btn-secondary" onClick={() => setActiveNote(null)} disabled={savingNote}>סגור</button>
            </div>
            <div className="space-y-3">
              {activeNote.kind === "research" ? (
                <div className="text-sm text-muted">
                  {activeNote.documentId ? (
                    <a href={`/research/${activeNote.documentId}`} className="text-accent hover:underline">
                      {activeNote.documentTitle ? `פתח מקור: ${activeNote.documentTitle}` : "פתח מקור במחקר"}
                    </a>
                  ) : "פתק מחקר ללא מקור מקושר"}
                </div>
              ) : null}
              <label className="block space-y-1">
                <span className="text-sm text-muted">כותרת</span>
                <input value={noteDraft.title} onChange={(e) => setNoteDraft((prev) => ({ ...prev, title: e.target.value }))} className="app-field" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-muted">הערה</span>
                <textarea value={noteDraft.content} onChange={(e) => setNoteDraft((prev) => ({ ...prev, content: e.target.value }))} className="app-textarea min-h-44" />
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
                <button type="button" className="app-btn app-btn-secondary" onClick={() => setActiveNote(null)} disabled={savingNote}>ביטול</button>
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
  try { return (await res.json()) as { error?: string }; }
  catch { return null; }
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-xl border border-black/12 bg-white/90 p-3">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>
    </article>
  );
}

function BlockWithAdd({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd: () => void }) {
  return (
    <section className="rounded-xl border border-black/12 bg-white/90 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={onAdd} className="app-btn app-btn-secondary px-2 py-0.5 text-xs leading-none">+</button>
      </div>
      {children}
    </section>
  );
}
