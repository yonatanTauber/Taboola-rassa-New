"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuickActions } from "@/components/QuickActions";

type PatientOption = {
  id: string;
  name: string;
};

type Option = { id: string; name: string };

export function ResearchUploadPanel({
  patients,
  authorsCatalog,
  topicsCatalog,
  sourcesCatalog,
  inModal = false,
  defaultPatientId = "",
  onSaveRef,
}: {
  patients: PatientOption[];
  authorsCatalog: Option[];
  topicsCatalog: Option[];
  sourcesCatalog: Option[];
  inModal?: boolean;
  defaultPatientId?: string;
  onSaveRef?: (handler: () => void) => void;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceCustom, setSourceCustom] = useState("");
  const [authors, setAuthors] = useState<string[]>([]);
  const [authorInput, setAuthorInput] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [patientId, setPatientId] = useState(defaultPatientId);
  const [kind, setKind] = useState("ARTICLE");
  const [externalUrl, setExternalUrl] = useState("");
  const [suggested, setSuggested] = useState(false);
  const [workspaceNotes, setWorkspaceNotes] = useState("");
  const [entryType, setEntryType] = useState<
    "ARTICLE_FILE" | "ARTICLE_LINK" | "BOOK" | "JOURNAL" | "NEWS" | "VIDEO_LINK"
  >("ARTICLE_FILE");


  const canAnalyze = Boolean(file) && !loading && entryType === "ARTICLE_FILE";
  const canAnalyzeLink = Boolean(externalUrl.trim()) && !loading && entryType !== "ARTICLE_FILE";
  const canSave = !saving;

  const selectedPatientName = useMemo(
    () => patients.find((patient) => patient.id === patientId)?.name ?? "",
    [patients, patientId],
  );
  const sourcesByName = useMemo(() => new Map(sourcesCatalog.map((item) => [item.name, item.id])), [sourcesCatalog]);
  const authorsByName = useMemo(() => new Set(authorsCatalog.map((item) => item.name)), [authorsCatalog]);
  const topicsByName = useMemo(() => new Set(topicsCatalog.map((item) => item.name)), [topicsCatalog]);
  const authorsLabel = entryType === "VIDEO_LINK" ? "מרצה/יוצר (מופרד בפסיקים)" : "כותבים (מופרד בפסיקים)";
  const sourceLabel =
    entryType === "VIDEO_LINK"
      ? "פלטפורמה / ערוץ"
      : entryType === "BOOK"
        ? "הוצאה / קטלוג"
        : entryType === "JOURNAL"
          ? "שם כתב העת"
          : entryType === "NEWS"
            ? "אתר / מקור כתבה"
            : "מקור / כתב עת";

  async function analyze() {
    if (!file) return;
    setLoading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/research/analyze", {
      method: "POST",
      body,
    });
    setLoading(false);

    if (!res.ok) {
      showToast({ message: "ניתוח המסמך נכשל. אפשר למלא ידנית." });
      return;
    }

    const payload = (await res.json()) as {
      metadata: { title: string; authors: string[]; topics: string[] };
    };

    setTitle(payload.metadata.title ?? "");
    setAuthors((payload.metadata.authors ?? []).filter(Boolean));
    setTopics((payload.metadata.topics ?? []).filter(Boolean));
    setSuggested(true);
    showToast({ message: "המערכת הציעה כותרת/כותבים/נושאים. אפשר לערוך ואז לשמור." });
  }

  async function analyzeLink() {
    if (!externalUrl.trim()) return;
    setLoading(true);
    const res = await fetch("/api/research/analyze-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: externalUrl.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      showToast({ message: "חילוץ מקישור נכשל. אפשר להמשיך ידנית." });
      return;
    }
    const payload = (await res.json()) as {
      metadata: { title?: string; authors?: string[]; topics?: string[]; source?: string };
    };
    if (payload.metadata.title) setTitle(payload.metadata.title);
    if (payload.metadata.authors?.length) setAuthors(payload.metadata.authors.filter(Boolean));
    if (payload.metadata.topics?.length) setTopics(payload.metadata.topics.filter(Boolean));
    if (payload.metadata.source) setSourceInput(payload.metadata.source);
    setSuggested(true);
    showToast({ message: "חולצו נתונים מהקישור. נא לעבור ולאשר." });
  }

  const save = useCallback(async () => {
    if (entryType === "ARTICLE_FILE" && !file && !externalUrl.trim() && !sourceInput.trim() && !title.trim()) {
      // Allow saving even with no inputs; will create a minimal record.
    }

    setSaving(true);
    const body = new FormData();
    if (file && entryType === "ARTICLE_FILE") body.append("file", file);
    const sourceValue = sourceInput.trim();
    const resolvedSourceId = sourceId || sourcesByName.get(sourceValue) || "";
    const resolvedSourceCustom = sourceCustom.trim() || (!resolvedSourceId && sourceValue ? sourceValue : "");

    body.append("title", title.trim());
    body.append("source", sourceValue);
    body.append("sourceId", resolvedSourceId);
    body.append("sourceCustom", resolvedSourceCustom);
    body.append("authors", authors.join(", "));
    body.append("topics", topics.join(", "));
    body.append("patientId", patientId);
    body.append("kind", effectiveKind(entryType, kind));
    body.append("externalUrl", externalUrl.trim());
    body.append("workspaceNotes", workspaceNotes.trim());

    const res = await fetch("/api/research/documents", {
      method: "POST",
      body,
    });
    setSaving(false);

    if (!res.ok) {
      let errorMessage = "שמירת המסמך נכשלה.";
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) errorMessage = payload.error;
      } catch {
        // keep fallback
      }
      showToast({ message: errorMessage });
      return;
    }

    setFile(null);
    setTitle("");
    setSourceInput("");
    setSourceId("");
    setSourceCustom("");
    setAuthors([]);
    setAuthorInput("");
    setTopics([]);
    setTopicInput("");
    setPatientId("");
    setKind("ARTICLE");
    setExternalUrl("");
    setWorkspaceNotes("");
    setSuggested(false);
    showToast({ message: "המסמך נשמר במרחב המחקר" });
    router.refresh();
  }, [authors, entryType, externalUrl, file, kind, patientId, showToast, sourceCustom, sourceId, sourceInput, topics, workspaceNotes, router, title, sourcesByName]);

  useEffect(() => {
    if (onSaveRef) onSaveRef(save);
  }, [onSaveRef, save]);

  return (
    <section className={`${inModal ? "" : "app-section"}`}>
      <h2 className="mb-3 text-lg font-semibold">העלאת מקור חדש</h2>
      <div className="space-y-2 text-sm">
        <label className="block space-y-1">
        <span className="text-xs font-medium text-muted">סוג מקור</span>
        <select
          aria-label="סוג מקור" name="entryType" autoComplete="off"
          value={entryType}
          onChange={(e) => {
            const next = e.target.value as "ARTICLE_FILE" | "ARTICLE_LINK" | "BOOK" | "JOURNAL" | "NEWS" | "VIDEO_LINK";
            setEntryType(next);
            setFile(null);
            setExternalUrl("");
            if (next === "VIDEO_LINK") setKind("VIDEO");
            if (next === "ARTICLE_LINK" || next === "ARTICLE_FILE") setKind("ARTICLE");
            if (next === "BOOK") setKind("BOOK");
            if (next === "JOURNAL") setKind("LECTURE_NOTE");
            if (next === "NEWS") setKind("OTHER");
          }}
          className="app-select"
        >
          <option value="ARTICLE_FILE">מאמר (קובץ)</option>
          <option value="ARTICLE_LINK">קישור למאמר (אינטרנט)</option>
          <option value="BOOK">ספר</option>
          <option value="JOURNAL">כתב עת</option>
          <option value="NEWS">כתבה</option>
          <option value="VIDEO_LINK">קישור לסרטון</option>
        </select>
        </label>

        {entryType === "ARTICLE_FILE" ? (
          <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">קובץ מקור</span>
          <input
            aria-label="קובץ מקור" name="file"
            type="file"
            accept=".pdf,.txt,.md"
            className="app-field"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              setSuggested(false);
            }}
          />
        </label>
        ) : null}

        {entryType !== "ARTICLE_FILE" ? (
          <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">קישור מקור</span>
          <input
            aria-label="קישור מקור" name="externalUrl" autoComplete="off"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder={
              entryType === "VIDEO_LINK"
                ? "קישור וידאו… לדוגמה: https://youtu.be/abc"
                : entryType === "BOOK"
                  ? "קישור לספר… לדוגמה: https://books.example"
                  : entryType === "JOURNAL"
                    ? "קישור לכתב עת… לדוגמה: https://journal.example"
                    : entryType === "NEWS"
                      ? "קישור לכתבה… לדוגמה: https://news.example"
                      : "קישור למאמר… לדוגמה: https://doi.org/"
            }
            className="app-field"
          />
        </label>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={analyze}
            disabled={!canAnalyze}
            className="app-btn app-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "מחלץ…" : "חלץ נתונים"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "שומר…" : "שמור"}
          </button>
          <button
            type="button"
            onClick={analyzeLink}
            disabled={!canAnalyzeLink}
            className="app-btn app-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "מחלץ…" : "חלץ מהקישור"}
          </button>
        </div>

        {loading ? <p className="text-xs text-muted">מנתח את הקובץ…</p> : null}
        {suggested ? <p className="text-xs text-accent">הצעה אוטומטית מולאה. נא לוודא ולאשר.</p> : null}

        <select name="kind" autoComplete="off" value={kind} onChange={(e) => setKind(e.target.value)} className="app-select">
          <option value="ARTICLE">מאמר</option>
          <option value="BOOK">ספר</option>
          <option value="VIDEO">וידאו</option>
          <option value="LECTURE_NOTE">הרצאה / סיכום</option>
          <option value="OTHER">אחר</option>
        </select>

        <input name="title" autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת פריט… לדוגמה: טראומה מורכבת" className="app-field" />

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted">מקור</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              list="research-source-options"
              name="source"
              autoComplete="off"
              value={sourceInput}
              onChange={(e) => {
                setSourceInput(e.target.value);
                setSourceId("");
                setSourceCustom("");
              }}
              placeholder={`${sourceLabel}… לדוגמה: JAMA`}
              className="app-field"
            />
            <button
              type="button"
              className="app-btn app-btn-secondary"
              onClick={() => {
                const candidate = sourceInput.trim();
                if (!candidate) return;
                const matchId = sourcesByName.get(candidate);
                if (matchId) {
                  setSourceId(matchId);
                  setSourceCustom("");
                  showToast({ message: "מקור קיים נבחר." });
                } else {
                  setSourceId("");
                  setSourceCustom(candidate);
                  showToast({ message: "מקור חדש יישמר בעת שמירה." });
                }
                setSourceInput(candidate);
              }}
            >
              הוסף מקור
            </button>
          </div>
          <datalist id="research-source-options">
            {sourcesCatalog.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
          {sourceId || sourceCustom ? (
            <div className="text-xs text-muted">מקור נבחר: {sourceInput.trim() || sourceCustom || "ללא"}</div>
          ) : null}
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted">{authorsLabel}</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              list="research-author-options"
              autoComplete="off"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              placeholder="הקלד/י שם כותב…"
              className="app-field"
            />
            <button
              type="button"
              className="app-btn app-btn-secondary"
              onClick={() => {
                const candidate = authorInput.trim();
                if (!candidate) return;
                setAuthors((prev) => (prev.includes(candidate) ? prev : [...prev, candidate]));
                setAuthorInput("");
                showToast({
                  message: authorsByName.has(candidate) ? "הכותב נוסף לרשימה." : "הכותב חדש ויישמר בעת שמירה.",
                });
              }}
            >
              הוסף כותב
            </button>
          </div>
          <datalist id="research-author-options">
            {authorsCatalog.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
          {authors.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {authors.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-0.5 text-xs"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => setAuthors((prev) => prev.filter((item) => item !== name))}
                    className="text-muted transition hover:text-rose-500"
                    aria-label={`הסר ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted">נושאים</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              list="research-topic-options"
              autoComplete="off"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="בחר/י או הקלד/י נושא…"
              className="app-field"
            />
            <button
              type="button"
              className="app-btn app-btn-secondary"
              onClick={() => {
                const candidate = topicInput.trim();
                if (!candidate) return;
                setTopics((prev) => (prev.includes(candidate) ? prev : [...prev, candidate]));
                setTopicInput("");
                showToast({
                  message: topicsByName.has(candidate) ? "הנושא נוסף לרשימה." : "הנושא חדש ויישמר בעת שמירה.",
                });
              }}
            >
              הוסף נושא
            </button>
          </div>
          <datalist id="research-topic-options">
            {topicsCatalog.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
          {topics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topics.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-0.5 text-xs"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => setTopics((prev) => prev.filter((item) => item !== name))}
                    className="text-muted transition hover:text-rose-500"
                    aria-label={`הסר ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <select name="patientId" autoComplete="off" value={patientId} onChange={(e) => setPatientId(e.target.value)} className="app-select">
          <option value="">ללא קישור למטופל</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </select>
        {selectedPatientName ? <p className="text-xs text-muted">יקושר למטופל: {selectedPatientName}</p> : null}

        <textarea
          name="workspaceNotes" autoComplete="off" value={workspaceNotes}
          onChange={(e) => setWorkspaceNotes(e.target.value)}
          placeholder="מלל חופשי קבוע על הפריט… (התרשמות, תובנות, מה חשוב לחזור אליו)"
          className="app-textarea min-h-44"
        />
      </div>
    </section>
  );
}

function effectiveKind(
  entryType: "ARTICLE_FILE" | "ARTICLE_LINK" | "BOOK" | "JOURNAL" | "NEWS" | "VIDEO_LINK",
  fallback: string,
) {
  if (entryType === "VIDEO_LINK") return "VIDEO";
  if (entryType === "BOOK") return "BOOK";
  if (entryType === "JOURNAL") return "LECTURE_NOTE";
  if (entryType === "NEWS") return "OTHER";
  if (entryType === "ARTICLE_LINK" || entryType === "ARTICLE_FILE") return "ARTICLE";
  return fallback;
}
