"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuickActions } from "@/components/QuickActions";

type Patient = { id: string; name: string };
type UnpaidSession = {
  id: string;
  scheduledAt: string;
  feeNis: number;
  paidNis: number;
  outstandingNis: number;
};

export function NewReceiptForm({ patients, initialPatientId }: { patients: Patient[]; initialPatientId?: string }) {
  const router = useRouter();

  const { showToast } = useQuickActions();
  const [patientId, setPatientId] = useState("");
  const [sessions, setSessions] = useState<UnpaidSession[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);


  async function loadPatientSessions(nextPatientId: string) {
    setPatientId(nextPatientId);
    setSelected({});
    if (!nextPatientId) {
      setSessions([]);
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/receipts/unpaid?patientId=${encodeURIComponent(nextPatientId)}`, {
      cache: "no-store",
    });
    setLoading(false);
    if (!res.ok) return;
    const data = (await res.json()) as { sessions: UnpaidSession[] };
    setSessions(data.sessions);
    setSelected(Object.fromEntries(data.sessions.map((s) => [s.id, s.outstandingNis])));
  }

  useEffect(() => {
    if (patientId) return;
    if (!initialPatientId) return;
    const timer = window.setTimeout(() => {
      loadPatientSessions(initialPatientId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [patientId, initialPatientId]);

  const total = useMemo(
    () => Object.values(selected).reduce((sum, amount) => sum + (Number.isFinite(amount) ? amount : 0), 0),
    [selected],
  );

  async function submitReceipt() {
    if (!patientId || total <= 0) return;
    setSaving(true);
    const allocations = Object.entries(selected).map(([sessionId, amountNis]) => ({ sessionId, amountNis }));
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        allocations,
      }),
    });
    setSaving(false);
    if (!res.ok) return;
    const payload = (await res.json()) as { receiptNumber: string };
    showToast({
      message: `הקבלה הופקה (${payload.receiptNumber})`,
      durationMs: 3500,
    });
    router.push("/receipts");
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-black/10 bg-white p-4">
      <h1 className="text-xl font-semibold">הזנת קבלה</h1>

      <label className="block space-y-1 text-sm">
        <span className="text-xs text-muted">מטופל</span>
        <select
          value={patientId}
          onChange={(e) => loadPatientSessions(e.target.value)}
          className="app-select"
        >
          <option value="">בחר מטופל</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </select>
      </label>

      <section className="rounded-xl border border-black/10 p-3">
        <h2 className="mb-2 text-sm font-semibold">פגישות שלא חויבו</h2>
        {loading ? <p className="text-sm text-muted">טוען פגישות...</p> : null}
        {!loading && sessions.length === 0 ? (
          <p className="text-sm text-muted">אין פגישות פתוחים לחיוב למטופל זה.</p>
        ) : null}
        <div className="space-y-2">
          {sessions.map((session) => {
            const checked = selected[session.id] !== undefined;
            return (
              <div key={session.id} className="rounded-lg border border-black/10 p-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) {
                          next[session.id] = session.outstandingNis;
                        } else {
                          delete next[session.id];
                        }
                        return next;
                      });
                    }}
                    className="mt-1 size-4 accent-accent"
                  />
                  <span className="grow truncate">
                    {new Date(session.scheduledAt).toLocaleDateString("he-IL")} · יתרה: ₪{session.outstandingNis}
                  </span>
                </label>
                {checked ? (
                  <input
                    type="number"
                    min="1"
                    max={session.outstandingNis}
                    value={selected[session.id]}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        [session.id]: Math.max(1, Math.min(session.outstandingNis, Number(e.target.value) || 0)),
                      }))
                    }
                    className="app-field mt-2 w-44"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <div className="rounded-xl border border-accent/20 bg-accent-soft px-3 py-2 text-sm text-accent">
        סכום קבלה: ₪{total}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="app-btn app-btn-secondary">
          ביטול
        </button>
        <button
          type="button"
          onClick={submitReceipt}
          disabled={!patientId || total <= 0 || saving}
          className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          שמור
        </button>
      </div>
    </section>
  );
}
