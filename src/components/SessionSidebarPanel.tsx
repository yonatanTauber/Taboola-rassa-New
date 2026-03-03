"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityLink } from "@/components/EntityLink";
import { SessionReceiptsPager } from "@/components/SessionReceiptsPager";
import { useQuickActions } from "@/components/QuickActions";
import { CustomSelect } from "@/components/CustomSelect";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  completedAt: string | null;
  dueAt: string | null;
};

type DocRow = {
  id: string;
  title: string;
  filePath: string;
};

type AllocationRow = {
  id: string;
  receiptId: string;
  receiptNumber: string;
  amountNis: number;
};

type GuidanceLinkRow = {
  guidanceId: string;
  guidanceTitle: string;
  scheduledAt: string | null;
  instructorName: string | null;
};

type ModalType = "task" | "receipt" | "guidance" | "medical-doc" | null;

export function SessionSidebarPanel({
  sessionId,
  patientId,
  feeNis,
  tasks,
  medicalDocuments,
  paymentAllocations,
  guidanceLinks,
}: {
  sessionId: string;
  patientId: string;
  feeNis: string;
  tasks: TaskRow[];
  medicalDocuments: DocRow[];
  paymentAllocations: AllocationRow[];
  guidanceLinks: GuidanceLinkRow[];
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  // Receipt form state
  const [receiptAmount, setReceiptAmount] = useState(feeNis);

  // Guidance form state
  const [guidanceTitle, setGuidanceTitle] = useState("");

  // Medical document form state
  const [medDocTitle, setMedDocTitle] = useState("");
  const [medDocUrl, setMedDocUrl] = useState("");
  const [medDocKind, setMedDocKind] = useState("OTHER");

  function openModalFor(type: ModalType) {
    if (type === "receipt") setReceiptAmount(feeNis);
    setOpenModal(type);
  }

  function closeModal() {
    if (!saving) setOpenModal(null);
  }

  async function createTask() {
    if (!taskTitle.trim()) {
      showToast({ message: "חובה להזין כותרת משימה." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          patientId,
          dueAt: taskDueDate || undefined,
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { error?: string };
        showToast({ message: p.error ?? "יצירת משימה נכשלה." });
        return;
      }
      showToast({ message: "משימה נוצרה" });
      setTaskTitle("");
      setTaskDueDate("");
      setOpenModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createReceipt() {
    const amount = Number(receiptAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({ message: "יש להזין סכום תקין." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          allocations: [{ sessionId, amountNis: amount }],
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { error?: string };
        showToast({ message: p.error ?? "הפקת קבלה נכשלה." });
        return;
      }
      showToast({ message: "קבלה הופקה בהצלחה" });
      setOpenModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createMedicalDoc() {
    if (!medDocTitle.trim()) {
      showToast({ message: "חובה להזין כותרת מסמך." });
      return;
    }
    if (!medDocUrl.trim()) {
      showToast({ message: "חובה להזין קישור לקובץ." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/medical-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          sessionId,
          title: medDocTitle.trim(),
          filePath: medDocUrl.trim(),
          kind: medDocKind,
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { error?: string };
        showToast({ message: p.error ?? "הוספת מסמך נכשלה." });
        return;
      }
      showToast({ message: "מסמך רפואי נוסף בהצלחה" });
      setMedDocTitle("");
      setMedDocUrl("");
      setMedDocKind("OTHER");
      setOpenModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function createGuidance() {
    setSaving(true);
    try {
      const res = await fetch("/api/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          title: guidanceTitle.trim() || "הדרכה ללא כותרת",
          sessionIds: [sessionId],
        }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => ({}))) as { error?: string };
        showToast({ message: p.error ?? "יצירת הדרכה נכשלה." });
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

  return (
    <>
      <section className="rounded-2xl border border-black/10 bg-white p-4">
        {/* Tasks Section */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">משימות קשורות</h2>
          <button
            type="button"
            onClick={() => openModalFor("task")}
            className="app-btn app-btn-primary px-2 py-1 text-xs"
          >
            +
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id}>
              <EntityLink
                type="task"
                id={t.id}
                label={t.title}
                variant="compact"
                meta={
                  t.status === "DONE"
                    ? `בוצעה ${t.completedAt ? new Date(t.completedAt).toLocaleDateString("he-IL") : ""}`
                    : t.dueAt
                      ? `לביצוע: ${new Date(t.dueAt).toLocaleDateString("he-IL")}`
                      : "ללא תאריך"
                }
                status={
                  t.status === "DONE"
                    ? { text: "בוצעה", tone: "bg-emerald-100 text-emerald-700" }
                    : { text: "פתוחה", tone: "bg-rose-100 text-rose-700" }
                }
              />
            </li>
          ))}
        </ul>

        {/* Medical Documents Section */}
        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted">מסמכים רפואיים מקושרים</h3>
          <button
            type="button"
            onClick={() => openModalFor("medical-doc")}
            className="app-btn app-btn-secondary px-2 py-1 text-xs"
          >
            +
          </button>
        </div>
        <ul className="mb-3 space-y-2 text-sm">
          {medicalDocuments.length > 0 ? (
            medicalDocuments.map((doc) => (
              <li key={doc.id}>
                <EntityLink
                  type="medical-document"
                  id={doc.id}
                  label={doc.title}
                  variant="compact"
                  href={doc.filePath}
                  external
                />
              </li>
            ))
          ) : (
            <li className="rounded-lg bg-black/[0.02] px-3 py-2 text-muted">אין מסמכים רפואיים מקושרים</li>
          )}
        </ul>

        {/* Receipts Section */}
        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted">קבלות משויכות</h3>
          <button
            type="button"
            onClick={() => openModalFor("receipt")}
            className="app-btn app-btn-secondary px-2 py-1 text-xs"
          >
            +
          </button>
        </div>
        <ul className="mb-3 space-y-2 text-sm">
          <SessionReceiptsPager items={paymentAllocations} />
        </ul>

        {/* Guidance Section */}
        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted">הדרכות מקושרות</h3>
          <button
            type="button"
            onClick={() => openModalFor("guidance")}
            className="app-btn app-btn-secondary px-2 py-1 text-xs"
          >
            +
          </button>
        </div>
        <ul className="mb-3 space-y-2 text-sm">
          {guidanceLinks.length > 0 ? (
            guidanceLinks.map((link) => (
              <li key={link.guidanceId}>
                <EntityLink
                  type="guidance"
                  id={link.guidanceId}
                  label={link.guidanceTitle}
                  variant="compact"
                  meta={`${link.scheduledAt ? new Date(link.scheduledAt).toLocaleDateString("he-IL") : "ללא מועד"}${link.instructorName ? ` · ${link.instructorName}` : ""}`}
                />
              </li>
            ))
          ) : (
            <li className="rounded-lg bg-black/[0.02] px-3 py-2 text-muted">אין הדרכות מקושרות</li>
          )}
        </ul>
      </section>

      {/* Quick-add Modals */}
      {openModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 px-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
            {openModal === "task" && (
              <>
                <h3 className="mb-4 text-lg font-semibold">משימה חדשה</h3>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">כותרת משימה</span>
                    <input
                      autoFocus
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createTask();
                      }}
                      className="app-field"
                      placeholder="הזן כותרת..."
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">תאריך יעד (אופציונלי)</span>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="app-field"
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="app-btn app-btn-secondary"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={() => void createTask()}
                    disabled={saving || !taskTitle.trim()}
                    className="app-btn app-btn-primary disabled:opacity-50"
                  >
                    {saving ? "יוצר..." : "צור משימה"}
                  </button>
                </div>
              </>
            )}

            {openModal === "receipt" && (
              <>
                <h3 className="mb-4 text-lg font-semibold">הפקת קבלה</h3>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">סכום (₪)</span>
                    <input
                      autoFocus
                      type="number"
                      min="1"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createReceipt();
                      }}
                      className="app-field"
                      placeholder="הזן סכום..."
                    />
                  </label>
                  <p className="text-xs text-muted">הקבלה תקושר אוטומטית לטיפול זה.</p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="app-btn app-btn-secondary"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={() => void createReceipt()}
                    disabled={saving || !receiptAmount}
                    className="app-btn app-btn-primary disabled:opacity-50"
                  >
                    {saving ? "מפיק..." : "הפק קבלה"}
                  </button>
                </div>
              </>
            )}

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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createGuidance();
                      }}
                      className="app-field"
                      placeholder="הזן כותרת (אופציונלי)..."
                    />
                  </label>
                  <p className="text-xs text-muted">
                    ההדרכה תקושר אוטומטית לטיפול זה. תוכל להשלים פרטים נוספים בדף ההדרכה.
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="app-btn app-btn-secondary"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={() => void createGuidance()}
                    disabled={saving}
                    className="app-btn app-btn-primary disabled:opacity-50"
                  >
                    {saving ? "יוצר..." : "צור הדרכה"}
                  </button>
                </div>
              </>
            )}

            {openModal === "medical-doc" && (
              <>
                <h3 className="mb-4 text-lg font-semibold">מסמך רפואי חדש</h3>
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">כותרת מסמך</span>
                    <input
                      autoFocus
                      value={medDocTitle}
                      onChange={(e) => setMedDocTitle(e.target.value)}
                      className="app-field"
                      placeholder="לדוגמה: תוצאות בדיקות דם..."
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">סוג מסמך</span>
                    <CustomSelect
                      value={medDocKind}
                      onChange={setMedDocKind}
                      options={[
                        { value: "OTHER", label: "אחר" },
                        { value: "EVALUATION", label: "הערכה" },
                        { value: "TEST_RESULT", label: "תוצאות בדיקה" },
                        { value: "HOSPITAL_SUMMARY", label: "סיכום אשפוז" },
                        { value: "REFERRAL", label: "הפניה" },
                      ]}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted">קישור לקובץ (URL)</span>
                    <input
                      type="url"
                      value={medDocUrl}
                      onChange={(e) => setMedDocUrl(e.target.value)}
                      className="app-field"
                      placeholder="https://..."
                    />
                  </label>
                  <p className="text-xs text-muted">הדבק קישור לקובץ שהועלה (Drive, Dropbox וכד׳).</p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="app-btn app-btn-secondary"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={() => void createMedicalDoc()}
                    disabled={saving || !medDocTitle.trim() || !medDocUrl.trim()}
                    className="app-btn app-btn-primary disabled:opacity-50"
                  >
                    {saving ? "שומר..." : "הוסף מסמך"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
