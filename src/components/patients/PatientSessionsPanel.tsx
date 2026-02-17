"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  id: string;
  scheduledAt: string;
  status: string;
  statusLabel: string;
  statusTone: string;
  billingLabel: string;
  billingTone: string;
  isFuture: boolean;
};

export function PatientSessionsPanel({
  rows,
  nowIso,
  patientId,
}: {
  rows: Row[];
  nowIso: string;
  patientId: string;
}) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [includeCancellations, setIncludeCancellations] = useState(false);
  const [cancelFrom, setCancelFrom] = useState("");
  const [cancelTo, setCancelTo] = useState("");

  const visible = useMemo(() => {
    const now = new Date(nowIso).getTime();
    const from = now - 30 * 24 * 60 * 60 * 1000;
    const until = now + 7 * 24 * 60 * 60 * 1000;

    return rows.filter((item) => {
      const canceled = item.status === "CANCELED" || item.status === "CANCELED_LATE";
      if (canceled && !includeCancellations) return false;
      const ts = new Date(item.scheduledAt).getTime();
      if (!showAllHistory && (ts < from || ts > until)) return false;

      if (canceled) {
        if (cancelFrom) {
          const fromDate = new Date(`${cancelFrom}T00:00:00`);
          if (ts < fromDate.getTime()) return false;
        }
        if (cancelTo) {
          const toDate = new Date(`${cancelTo}T23:59:59.999`);
          if (ts > toDate.getTime()) return false;
        }
      }

      return true;
    });
  }, [rows, showAllHistory, nowIso, includeCancellations, cancelFrom, cancelTo]);

  return (
    <section className="app-section space-y-3 border-black/18">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">פגישות פגישה</h2>
          <Link
            href={`/sessions/new?patientId=${patientId}`}
            className="app-btn app-btn-secondary h-7 w-7 !px-0 text-center text-sm"
            title="הוספת פגישה למטופל"
          >
            +
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" className="accent-accent" checked={showAllHistory} onChange={(e) => setShowAllHistory(e.target.checked)} />
            הצג גם פגישות עבר
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="accent-accent"
              checked={includeCancellations}
              onChange={(e) => setIncludeCancellations(e.target.checked)}
            />
            כלול ביטולים
          </label>
        </div>
      </div>

      {includeCancellations ? (
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1 text-xs text-muted">
            <span>ביטולים מתאריך</span>
            <input type="date" value={cancelFrom} onChange={(e) => setCancelFrom(e.target.value)} className="app-field" />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>ביטולים עד תאריך</span>
            <input type="date" value={cancelTo} onChange={(e) => setCancelTo(e.target.value)} className="app-field" />
          </label>
        </div>
      ) : null}

      <ul className="space-y-2">
        {visible.map((row) => (
          <li key={row.id}>
            <Link href={`/sessions/${row.id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 hover:bg-black/[0.02]">
              <div className="min-w-0">
                <div className="truncate text-sm text-ink">
                  {new Date(row.scheduledAt).toLocaleDateString("he-IL")} ·{" "}
                  {new Date(row.scheduledAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className={`text-xs ${row.isFuture ? "text-indigo-700" : "text-muted"}`}>{row.isFuture ? "פגישה עתידית" : "פגישה שהתקיימה/נקבעה"}</div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs ${row.statusTone}`}>{row.statusLabel}</span>
              <span className={`rounded-full px-2 py-1 text-xs ${row.billingTone}`}>{row.billingLabel}</span>
            </Link>
          </li>
        ))}
        {visible.length === 0 ? <li className="rounded-lg bg-black/[0.02] px-3 py-2 text-sm text-muted">אין פגישות להצגה בטווח שנבחר.</li> : null}
      </ul>
    </section>
  );
}
