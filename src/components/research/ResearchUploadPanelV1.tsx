"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuickActions } from "@/components/QuickActions";

type Option = { id: string; name: string };

type UploadMode = "FILE" | "LINK" | "BASIC";

export function ResearchUploadPanelV1({
  patients,
  defaultPatientId = "",
  onSaveRef,
}: {
  patients: Option[];
  defaultPatientId?: string;
  onSaveRef?: (handler: () => void) => void;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();

  const [uploadMode, setUploadMode] = useState<UploadMode>("FILE");
  const [saving, setSaving] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("ARTICLE");
  const [source, setSource] = useState("");
  const [authorsCsv, setAuthorsCsv] = useState("");
  const [topicsCsv, setTopicsCsv] = useState("");
  const [patientId, setPatientId] = useState(defaultPatientId);
  const [workspaceNotes, setWorkspaceNotes] = useState("");

  const save = useCallback(async () => {
    setSaving(true);

    const body = new FormData();
    if (uploadMode === "FILE" && file) {
      body.append("file", file);
    }
    if (uploadMode === "LINK") {
      body.append("externalUrl", externalUrl.trim());
    }

    body.append("title", title.trim());
    body.append("kind", kind);
    body.append("source", source.trim());
    body.append("authors", authorsCsv.trim());
    body.append("topics", topicsCsv.trim());
    body.append("patientId", patientId);
    body.append("workspaceNotes", workspaceNotes.trim());

    let res: Response;
    try {
      res = await fetch("/api/research-upload-v1", {
        method: "POST",
        body,
      });
    } catch {
      setSaving(false);
      showToast({ message: "שמירת המסמך נכשלה (שגיאת רשת)." });
      return;
    }

    setSaving(false);

    if (!res.ok) {
      let message = `שמירת המסמך נכשלה (${res.status}).`;
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) message = payload.error;
      } catch {
        // keep default
      }
      showToast({ message });
      return;
    }

    setFile(null);
    setExternalUrl("");
    setTitle("");
    setKind("ARTICLE");
    setSource("");
    setAuthorsCsv("");
    setTopicsCsv("");
    setPatientId("");
    setWorkspaceNotes("");

    showToast({ message: "המסמך נשמר במרחב המחקר" });
    router.refresh();
  }, [authorsCsv, externalUrl, file, kind, patientId, router, showToast, source, title, topicsCsv, uploadMode, workspaceNotes]);

  useEffect(() => {
    onSaveRef?.(save);
  }, [onSaveRef, save]);

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted">הנתונים לא נשמרים אוטומטית. שמירה מתבצעת רק בלחיצה על &quot;שמור&quot;.</p>
      <div className="grid gap-2 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setUploadMode("FILE")}
          className={`app-btn ${uploadMode === "FILE" ? "app-btn-primary" : "app-btn-secondary"}`}
        >
          קובץ
        </button>
        <button
          type="button"
          onClick={() => setUploadMode("LINK")}
          className={`app-btn ${uploadMode === "LINK" ? "app-btn-primary" : "app-btn-secondary"}`}
        >
          קישור
        </button>
        <button
          type="button"
          onClick={() => setUploadMode("BASIC")}
          className={`app-btn ${uploadMode === "BASIC" ? "app-btn-primary" : "app-btn-secondary"}`}
        >
          מטא-דאטה בסיסי
        </button>
      </div>

      {uploadMode === "FILE" ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">קובץ מקור</span>
          <input
            type="file"
            accept=".pdf,.txt,.md,.doc,.docx"
            className="app-field"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      ) : null}

      {uploadMode === "LINK" ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">קישור מקור</span>
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://..."
            className="app-field"
          />
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">כותרת</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת מקור (אופציונלי)"
          className="app-field"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">סוג</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="app-select">
          <option value="ARTICLE">מאמר</option>
          <option value="BOOK">ספר</option>
          <option value="VIDEO">וידאו</option>
          <option value="LECTURE_NOTE">הרצאה / סיכום</option>
          <option value="OTHER">אחר</option>
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">מקור</span>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="מקור / כתב עת / פלטפורמה"
          className="app-field"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">כותבים (מופרד בפסיקים)</span>
        <input
          value={authorsCsv}
          onChange={(e) => setAuthorsCsv(e.target.value)}
          placeholder="שם כותב 1, שם כותב 2"
          className="app-field"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">נושאים (מופרד בפסיקים)</span>
        <input
          value={topicsCsv}
          onChange={(e) => setTopicsCsv(e.target.value)}
          placeholder="טראומה, CBT"
          className="app-field"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">קישור למטופל (אופציונלי)</span>
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="app-select">
          <option value="">ללא קישור למטופל</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">הערות</span>
        <textarea
          value={workspaceNotes}
          onChange={(e) => setWorkspaceNotes(e.target.value)}
          placeholder="הערות חופשיות"
          className="app-textarea min-h-28"
        />
      </label>

      <div className="text-xs text-muted">
        {saving ? "שומר..." : "מוכן לשמירה"}
      </div>
    </section>
  );
}
