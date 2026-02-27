"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EntityBadge } from "@/components/EntityBadge";
import { EntityLink } from "@/components/EntityLink";
import { ResearchUploadPanel } from "@/components/research/ResearchUploadPanel";

type Doc = {
  id: string;
  kind: string;
  title: string;
  source: string | null;
  externalUrl: string | null;
  filePath: string | null;
  workspaceNotes: string | null;
  createdAt: string;
  authors: string[];
  topics: string[];
  linkedPatients: { id: string; name: string }[];
};

type Option = { id: string; name: string };

export function ResearchWorkspace({
  docs,
  patients,
  authorsCatalog,
  topicsCatalog,
  sourcesCatalog,
  initialFilters,
}: {
  docs: Doc[];
  patients: Option[];
  authorsCatalog: Option[];
  topicsCatalog: Option[];
  sourcesCatalog: Option[];
  initialFilters: { q: string; kind: string; topic: string; author: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialFilters.q);
  const [kind, setKind] = useState(initialFilters.kind);
  const [topic, setTopic] = useState(initialFilters.topic);
  const [author, setAuthor] = useState(initialFilters.author);
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);

  const topicOptions = useMemo(
    () => [...new Set(docs.flatMap((doc) => doc.topics).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")),
    [docs],
  );
  const authorOptions = useMemo(
    () => [...new Set(docs.flatMap((doc) => doc.authors).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")),
    [docs],
  );

  const filtered = useMemo(() => {
    return docs.filter((doc) => {
      if (kind !== "ALL" && doc.kind !== kind) return false;
      if (topic !== "ALL" && !doc.topics.includes(topic)) return false;
      if (author !== "ALL" && !doc.authors.includes(author)) return false;
      if (linkedOnly && doc.linkedPatients.length === 0) return false;
      const text = `${doc.title} ${doc.source ?? ""} ${doc.authors.join(" ")} ${doc.topics.join(" ")}`.toLowerCase();
      return text.includes(q.trim().toLowerCase());
    });
  }, [docs, q, kind, topic, author, linkedOnly]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (kind && kind !== "ALL") params.set("kind", kind);
    if (topic && topic !== "ALL") params.set("topic", topic);
    if (author && author !== "ALL") params.set("author", author);
    const next = params.toString();
    router.replace(next ? `?${next}` : "", { scroll: false });
  }, [q, kind, topic, author, router]);

  const stats = useMemo(() => {
    const byKind = docs.reduce<Record<string, number>>((acc, doc) => {
      acc[doc.kind] = (acc[doc.kind] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total: docs.length,
      articles: byKind.ARTICLE ?? 0,
      books: byKind.BOOK ?? 0,
      videos: byKind.VIDEO ?? 0,
      linked: docs.filter((doc) => doc.linkedPatients.length > 0).length,
    };
  }, [docs]);

  function toggleKind(k: string) {
    setKind((prev) => (prev === k ? "ALL" : k));
  }

  return (
    <main className="space-y-3">
      <section className="app-section">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="me-auto text-xl font-semibold">מרחב מחקר אישי</h1>
          <button className="app-btn app-btn-primary" onClick={() => setOpenUpload(true)}>
            העלאת מקור חדש
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          <Stat
            label="סה״כ מקורות"
            value={stats.total}
            active={kind === "ALL" && !linkedOnly}
            onClick={() => { setKind("ALL"); setLinkedOnly(false); }}
          />
          <Stat
            label="מאמרים"
            value={stats.articles}
            active={kind === "ARTICLE"}
            onClick={() => { toggleKind("ARTICLE"); setLinkedOnly(false); }}
          />
          <Stat
            label="ספרים"
            value={stats.books}
            active={kind === "BOOK"}
            onClick={() => { toggleKind("BOOK"); setLinkedOnly(false); }}
          />
          <Stat
            label="וידאו"
            value={stats.videos}
            active={kind === "VIDEO"}
            onClick={() => { toggleKind("VIDEO"); setLinkedOnly(false); }}
          />
          <Stat
            label="מקושרים למטופלים"
            value={stats.linked}
            active={linkedOnly}
            onClick={() => { setLinkedOnly((v) => !v); setKind("ALL"); }}
          />
        </div>
      </section>

      <section className="app-section">
        <div className="grid gap-2 md:grid-cols-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש חופשי… לדוגמה: חרדה, CBT" className="app-field" aria-label="חיפוש במקורות" name="q" autoComplete="off" />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="app-select" aria-label="סינון לפי סוג מקור" name="kind" autoComplete="off">
            <option value="ALL">כל סוגי המקורות</option>
            <option value="ARTICLE">מאמר</option>
            <option value="BOOK">ספר</option>
            <option value="VIDEO">סרטון</option>
            <option value="LECTURE_NOTE">הרצאה / סיכום</option>
            <option value="OTHER">אחר</option>
          </select>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="app-select" aria-label="סינון לפי נושא" name="topic" autoComplete="off">
            <option value="ALL">כל הנושאים</option>
            {topicOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select value={author} onChange={(e) => setAuthor(e.target.value)} className="app-select" aria-label="סינון לפי כותב" name="author" autoComplete="off">
            <option value="ALL">כל הכותבים</option>
            {authorOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="app-section space-y-2 content-visibility-auto">
        {filtered.map((doc) => (
          <article key={doc.id} className="rounded-xl border border-black/14 bg-white/96 px-3 py-2">
            <div className="flex flex-wrap items-start gap-2">
              <Link href={`/research/${doc.id}`} className="me-auto min-w-0 truncate font-semibold text-accent hover:underline">{doc.title}</Link>
              <EntityBadge type="research-document" compact />
              <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-muted">{kindLabel(doc.kind)}</span>
            </div>
            <p className="text-xs text-muted">מקור: {doc.source ?? "לא צוין"}</p>
            <p className="text-xs text-muted">כותבים: {doc.authors.length ? doc.authors.join(", ") : "לא צוינו"}</p>
            <p className="text-xs text-muted">נושאים: {doc.topics.length ? doc.topics.join(", ") : "ללא"}</p>
            {doc.linkedPatients.length > 0 ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted">מקושר:</span>
                {doc.linkedPatients.map((p) => (
                  <EntityLink key={p.id} type="patient" id={p.id} label={p.name} />
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted">נוסף בתאריך {new Date(doc.createdAt).toLocaleDateString("he-IL")}</p>
          </article>
        ))}
        {filtered.length === 0 ? <div className="rounded-lg bg-black/[0.03] px-3 py-2 text-sm text-muted">אין תוצאות לפילטרים שנבחרו.</div> : null}
      </section>

      {openUpload ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/25 px-3 backdrop-blur-sm overscroll-contain" onClick={(e) => e.target === e.currentTarget && setOpenUpload(false)}>
          <div className="w-[min(94vw,980px)] rounded-2xl border border-black/16 bg-white p-4 shadow-2xl">
            <div className="mb-2 flex items-center">
              <h2 className="me-auto text-lg font-semibold">העלאת מקור חדש</h2>
              <button className="app-btn app-btn-secondary" onClick={() => setOpenUpload(false)}>סגור</button>
            </div>
            <div className="max-h-[78vh] overflow-auto">
              <ResearchUploadPanel
                inModal
                patients={patients}
                authorsCatalog={authorsCatalog}
                topicsCatalog={topicsCatalog}
                sourcesCatalog={sourcesCatalog}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Stat({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const base = "rounded-xl border px-3 py-2 text-start transition-colors";
  const activeClass = "border-accent bg-accent-soft";
  const idleClass = "border-black/14 bg-white/95 hover:bg-accent-soft/40 cursor-pointer";

  return (
    <button onClick={onClick} className={`${base} ${active ? activeClass : idleClass}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold text-ink tabular-nums">{value}</div>
    </button>
  );
}

function kindLabel(kind: string) {
  if (kind === "ARTICLE") return "מאמר";
  if (kind === "BOOK") return "ספר";
  if (kind === "VIDEO") return "סרטון";
  if (kind === "LECTURE_NOTE") return "הרצאה";
  return "אחר";
}
