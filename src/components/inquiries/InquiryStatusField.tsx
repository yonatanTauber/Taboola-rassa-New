"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type InquiryStatusValue = "NEW" | "DISCOVERY_CALL" | "WAITLIST" | "CONVERTED" | "CLOSED";

const STATUS_LABEL: Record<InquiryStatusValue, string> = {
  NEW: "חדשה",
  DISCOVERY_CALL: "שיחת היכרות",
  WAITLIST: "המתנה",
  CONVERTED: "הפכה למטופל",
  CLOSED: "נסגרה",
};

export function InquiryStatusField({
  inquiryId,
  initialStatus,
}: {
  inquiryId: string;
  initialStatus: InquiryStatusValue;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<InquiryStatusValue>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);

  const locked = status === "CONVERTED" || status === "CLOSED";

  async function saveStatus(nextStatus: InquiryStatusValue) {
    const previous = status;
    setStatus(nextStatus);
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: InquiryStatusValue;
        patientId?: string | null;
      };

      if (!res.ok) {
        setStatus(previous);
        setError(payload.error ?? "שמירת הסטטוס נכשלה.");
        return false;
      }

      if (payload.status) {
        setStatus(payload.status);
      }

      if (nextStatus === "CONVERTED" && payload.patientId) {
        router.push(`/patients/${payload.patientId}`);
      } else {
        router.refresh();
      }

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
      {locked ? (
        <button
          type="button"
          className="app-select w-full text-right"
          onClick={() => setRestoreOpen(true)}
          disabled={saving}
          aria-label="סטטוס נעול. לחצו להשבה לפנייה פעילה"
        >
          {STATUS_LABEL[status]} (נעול)
        </button>
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

      <ConfirmDialog
        open={restoreOpen}
        title="להשיב את הפנייה למצב פעיל?"
        message="הסטטוס נעול לאחר מעבר לסטטוס סופי. ניתן להשיב את הפנייה לסטטוס 'חדשה' ולהמשיך לעדכן אותה."
        confirmLabel="השב לפנייה פעילה"
        cancelLabel="ביטול"
        danger={false}
        busy={saving}
        onCancel={() => setRestoreOpen(false)}
        onConfirm={async () => {
          const ok = await saveStatus("NEW");
          if (ok) setRestoreOpen(false);
        }}
      />
    </div>
  );
}
