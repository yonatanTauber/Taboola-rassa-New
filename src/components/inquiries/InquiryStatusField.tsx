"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type InquiryStatusValue = "NEW" | "DISCOVERY_CALL" | "WAITLIST" | "CONVERTED" | "CLOSED";

const STATUS_LABEL: Record<InquiryStatusValue, string> = {
  NEW: "חדשה",
  DISCOVERY_CALL: "שיחת היכרות",
  WAITLIST: "המתנה",
  CONVERTED: "הפכה למטופל",
  CLOSED: "נסגרה",
};

function todayInputValue() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function InquiryStatusField({
  inquiryId,
  initialStatus,
  patientId,
}: {
  inquiryId: string;
  initialStatus: InquiryStatusValue;
  patientId?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<InquiryStatusValue>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateDate, setReactivateDate] = useState(todayInputValue);
  const [reactivateReason, setReactivateReason] = useState("");
  const [linkedPatientId, setLinkedPatientId] = useState<string | null>(patientId ?? null);

  const convertedLocked = status === "CONVERTED";
  const closedLocked = status === "CLOSED";

  const lockedLabel = useMemo(() => {
    if (convertedLocked) return `${STATUS_LABEL[status]} (נעול)`;
    if (closedLocked) return `${STATUS_LABEL[status]} (סגור)`;
    return "";
  }, [closedLocked, convertedLocked, status]);

  async function saveStatus(
    nextStatus: InquiryStatusValue,
    extra?: { reactivatedAt?: string; reactivationReason?: string },
  ) {
    const previous = status;
    setStatus(nextStatus);
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, ...extra }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        status?: InquiryStatusValue;
        patientId?: string | null;
      };

      if (!res.ok) {
        setStatus(previous);
        if (payload.code === "REACTIVATION_REQUIRED" && nextStatus === "CONVERTED") {
          if (typeof payload.patientId === "string") {
            setLinkedPatientId(payload.patientId);
          }
          setReactivateOpen(true);
          return false;
        }
        setError(payload.error ?? "שמירת הסטטוס נכשלה.");
        return false;
      }

      if (payload.status) {
        setStatus(payload.status);
      }
      if (typeof payload.patientId === "string") {
        setLinkedPatientId(payload.patientId);
      }

      router.refresh();
      return true;
    } catch {
      setStatus(previous);
      setError("שמירת הסטטוס נכשלה.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {convertedLocked || closedLocked ? (
        <div className="space-y-1">
          <div className="app-select w-full text-right text-xs text-muted">{lockedLabel}</div>
          {convertedLocked && linkedPatientId ? (
            <Link href={`/patients/${linkedPatientId}`} className="text-xs text-accent hover:underline">
              פתח/י מטופל
            </Link>
          ) : null}
          {closedLocked ? (
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              disabled={saving}
              onClick={async () => {
                const ok = await saveStatus("NEW");
                if (ok) setError("");
              }}
            >
              פתח/י מחדש פנייה
            </button>
          ) : null}
        </div>
      ) : (
        <select
          name="status"
          value={status}
          onChange={(event) => {
            const next = event.target.value as InquiryStatusValue;
            void saveStatus(next);
          }}
          className="app-select"
          disabled={saving}
        >
          <option value="NEW">חדשה</option>
          <option value="DISCOVERY_CALL">שיחת היכרות</option>
          <option value="WAITLIST">המתנה</option>
          <option value="CONVERTED">הפכה למטופל</option>
          <option value="CLOSED">נסגרה</option>
        </select>
      )}

      <div className="mt-1 min-h-4 text-[11px]">
        {saving ? <span className="text-muted">שומר...</span> : null}
        {!saving && error ? <span className="text-danger">{error}</span> : null}
      </div>

      {reactivateOpen ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/35 px-3"
          onClick={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setReactivateOpen(false);
            }
          }}
        >
          <div role="dialog" aria-modal="true" className="w-[min(92vw,34rem)] rounded-2xl border border-black/16 bg-white p-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink">החזרת מטופל למצב פעיל</h3>
            <p className="mt-1 text-sm text-muted">
              כדי להשלים המרה של הפנייה, יש להשיב את המטופל למצב פעיל עם תאריך וסיבה.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted">תאריך חזרה לטיפול *</span>
                <input
                  type="date"
                  value={reactivateDate}
                  onChange={(event) => setReactivateDate(event.target.value)}
                  className="app-field"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-muted">סיבת חזרה לטיפול *</span>
                <textarea
                  value={reactivateReason}
                  onChange={(event) => setReactivateReason(event.target.value)}
                  className="app-textarea min-h-24"
                  placeholder="מה השתנה שהוביל לחזרה לטיפול?"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="app-btn app-btn-secondary"
                onClick={() => setReactivateOpen(false)}
                disabled={saving}
              >
                ביטול
              </button>
              <button
                type="button"
                className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving || !reactivateDate || !reactivateReason.trim()}
                onClick={async () => {
                  const ok = await saveStatus("CONVERTED", {
                    reactivatedAt: reactivateDate,
                    reactivationReason: reactivateReason.trim(),
                  });
                  if (ok) {
                    setReactivateOpen(false);
                    setReactivateReason("");
                  }
                }}
              >
                {saving ? "שומר..." : "השב למצב פעיל"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
