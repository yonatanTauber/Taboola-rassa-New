"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
}: {
  patients: PatientOption[];
  authorsCatalog: Option[];
  topicsCatalog: Option[];
  sourcesCatalog: Option[];
  inModal?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceCustom, setSourceCustom] = useState("");
  const [authors, setAuthors] = useState("");
  const [authorPick, setAuthorPick] = useState("");
  const [authorCustom, setAuthorCustom] = useState("");
  const [topics, setTopics] = useState("");
  const [topicPick, setTopicPick] = useState("");
  const [topicCustom, setTopicCustom] = useState("");
  const [patientId, setPatientId] = useState("");
  const [kind, setKind] = useState("ARTICLE");
  const [externalUrl, setExternalUrl] = useState("");
  const [suggested, setSuggested] = useState(false);
  const [workspaceNotes, setWorkspaceNotes] = useState("");
  const [entryType, setEntryType] = useState<
    "ARTICLE_FILE" | "ARTICLE_LINK" | "BOOK" | "JOURNAL" | "NEWS" | "VIDEO_LINK"
  >("ARTICLE_FILE");

  const canAnalyze = Boolean(file) && !loading && entryType === "ARTICLE_FILE";
  const canAnalyzeLink = Boolean(externalUrl.trim()) && !loading && entryType !== "ARTICLE_FILE";
  const canSave =
    (Boolean(file) || Boolean(externalUrl.trim())) &&
    Boolean(title.trim()) &&
    !saving;

  const selectedPatientName = useMemo(
    () => patients.find((patient) => patient.id === patientId)?.name ?? "",
    [patients, patientId],
  );
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
    setAuthors(payload.metadata.authors?.join(", ") ?? "");
    setTopics(payload.metadata.topics?.join(", ") ?? "");
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
    if (payload.metadata.authors?.length) setAuthors(payload.metadata.authors.join(", "));
    if (payload.metadata.topics?.length) setTopics(payload.metadata.topics.join(", "));
    if (payload.metadata.source) setSource(payload.metadata.source);
    setSuggested(true);
    showToast({ message: "חולצו נתונים מהקישור. נא לעבור ולאשר." });
  }

  async function save() {
    if (!title.trim()) return;
    if (entryType === "ARTICLE_FILE" && !file) return;
    if (entryType !== "ARTICLE_FILE" && !externalUrl.trim()) return;

    setSaving(true);
    const body = new FormData();
    if (file && entryType === "ARTICLE_FILE") body.append("file", file);
    body.append("title", title.trim());
    body.append("source", source.trim());
    body.append("sourceId", sourceId);
    body.append("sourceCustom", sourceCustom.trim());
    body.append("authors", authors.trim());
    body.append("topics", topics.trim());
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
      showToast({ message: "שמירת המסמך נכשלה." });
      return;
    }

    setFile(null);
    setTitle("");
    setSource("");
    setSourceId("");
    setSourceCustom("");
    setAuthors("");
    setAuthorPick("");
    setAuthorCustom("");
    setTopics("");
    setTopicPick("");
    setTopicCustom("");
    setPatientId("");
    setKind("ARTICLE");
    setExternalUrl("");
    setWorkspaceNotes("");
    setSuggested(false);
    showToast({ message: "המסמך נשמר במרחב המחקר" });
    router.refresh();
  }

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
        <input name="source" autoComplete="off" value={source} onChange={(e) => setSource(e.target.value)} placeholder={`${sourceLabel}… לדוגמה: JAMA (טקסט חופשי)`} className="app-field" />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select name="sourceId" autoComplete="off" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="app-select">
            <option value="">בחר מקור קיים</option>
            {sourcesCatalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            <option value="__custom__">אחר</option>
          </select>
          {sourceId === "__custom__" ? (
            <input
              name="sourceCustom" autoComplete="off" value={sourceCustom}
              onChange={(e) => setSourceCustom(e.target.value)}
              placeholder="מקור חדש…"
              className="app-field"
            />
          ) : (
            <div />
          )}
        </div>

        <input name="authors" autoComplete="off" value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder={`${authorsLabel}… לדוגמה: Freud, Klein`} className="app-field" />
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <select name="authorPick" autoComplete="off" value={authorPick} onChange={(e) => setAuthorPick(e.target.value)} className="app-select">
            <option value="">בחר כותב קיים</option>
            {authorsCatalog.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
            <option value="__custom__">אחר</option>
          </select>
          {authorPick === "__custom__" ? (
            <input name="authorCustom" autoComplete="off" value={authorCustom} onChange={(e) => setAuthorCustom(e.target.value)} placeholder="כותב חדש…" className="app-field" />
          ) : (
            <div />
          )}
          <button
            type="button"
            className="app-btn app-btn-secondary"
            onClick={() => {
              const candidate = authorPick === "__custom__" ? authorCustom.trim() : authorPick.trim();
              if (!candidate) return;
              const list = authors
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              if (!list.includes(candidate)) {
                setAuthors([...list, candidate].join(", "));
              }
              setAuthorPick("");
              setAuthorCustom("");
            }}
          >
            הוסף כותב
          </button>
        </div>

        <input name="topics" autoComplete="off" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="נושאים… לדוגמה: חרדה, CBT" className="app-field" />
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <select name="topicPick" autoComplete="off" value={topicPick} onChange={(e) => setTopicPick(e.target.value)} className="app-select">
            <option value="">בחר נושא קיים</option>
            {topicsCatalog.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
            <option value="__custom__">אחר</option>
          </select>
          {topicPick === "__custom__" ? (
            <input name="topicCustom" autoComplete="off" value={topicCustom} onChange={(e) => setTopicCustom(e.target.value)} placeholder="נושא חדש…" className="app-field" />
          ) : (
            <div />
          )}
          <button
            type="button"
            className="app-btn app-btn-secondary"
            onClick={() => {
              const candidate = topicPick === "__custom__" ? topicCustom.trim() : topicPick.trim();
              if (!candidate) return;
              const list = topics
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              if (!list.includes(candidate)) {
                setTopics([...list, candidate].join(", "));
              }
              setTopicPick("");
              setTopicCustom("");
            }}
          >
            הוסף נושא
          </button>
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
