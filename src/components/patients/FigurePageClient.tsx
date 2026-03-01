"use client";

import Link from "next/link";
import { useState } from "react";
import { BackButton } from "@/components/BackButton";

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

const SESSION_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "נקבעה",
  COMPLETED: "הושלמה",
  CANCELED: "בוטלה",
  CANCELED_LATE: "ביטול מאוחר",
  UNDOCUMENTED: "לא תועדה",
};

type Appearance = {
  sessionId: string;
  scheduledAt: string;
  status: string;
  markdown: string;
};

function highlightName(text: string, figureName: string): React.ReactNode[] {
  if (!figureName.trim()) return [text];
  const escaped = figureName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-yellow-200 font-bold px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function FigurePageClient({
  name,
  role,
  notes,
  patientId,
  patientName,
  appearances,
}: {
  name: string;
  role: string;
  notes: string | null;
  patientId: string;
  patientName: string;
  appearances: Appearance[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <main className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl font-semibold text-ink">{name}</h1>
      </div>

      <section className="app-section space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-black/[0.06] px-3 py-1 font-medium text-ink">
            {FIGURE_ROLE_LABELS[role] ?? role}
          </span>
          <Link href={`/patients/${patientId}`} className="text-accent hover:underline">
            {patientName}
          </Link>
        </div>
        {notes && <p className="text-sm text-muted leading-relaxed">{notes}</p>}
      </section>

      <section className="app-section">
        <h2 className="mb-3 text-base font-semibold text-ink">
          הופעות בסשנים ({appearances.length})
        </h2>
        {appearances.length === 0 ? (
          <p className="text-sm text-muted">השם לא נמצא בהערות סשנים.</p>
        ) : (
          <ul className="divide-y divide-black/6">
            {appearances.map((a) => (
              <li key={a.sessionId}>
                <button
                  onClick={() =>
                    setExpandedId(expandedId === a.sessionId ? null : a.sessionId)
                  }
                  className="flex w-full items-center justify-between px-1 py-2.5 text-start hover:bg-black/[0.02] rounded-lg"
                >
                  <span className="text-sm font-medium text-ink">
                    {new Date(a.scheduledAt).toLocaleDateString("he-IL", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-muted">
                      {SESSION_STATUS_LABELS[a.status] ?? a.status}
                    </span>
                    <span className="text-xs text-muted" aria-hidden>
                      {expandedId === a.sessionId ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {expandedId === a.sessionId && (
                  <div className="px-2 pb-3 pt-1">
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-ink/80 font-sans">
                      {highlightName(a.markdown, name)}
                    </pre>
                    <Link
                      href={`/sessions/${a.sessionId}`}
                      className="mt-2 inline-block text-xs text-accent hover:underline"
                    >
                      פתח סשן →
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
