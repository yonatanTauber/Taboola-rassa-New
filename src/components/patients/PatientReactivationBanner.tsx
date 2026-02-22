"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuickActions } from "@/components/QuickActions";
import { PatientStatusDialog } from "@/components/patients/PatientStatusDialog";

export function PatientReactivationBanner({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">המטופל במצב לא פעיל</div>
          <div className="text-xs text-amber-800">
            התיק נשמר ונגיש לצפייה. המטופל לא יוצע לקישורים חדשים עד להשבה למצב פעיל.
          </div>
        </div>
        <button type="button" className="app-btn app-btn-primary" onClick={() => setOpen(true)}>
          השב לפעיל
        </button>
      </div>

      <PatientStatusDialog
        open={open}
        mode="reactivate"
        busy={busy}
        onCancel={() => setOpen(false)}
        onSubmit={async (payload) => {
          setBusy(true);
          const res = await fetch(`/api/patients/${patientId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "reactivate",
              reactivatedAt: payload.date,
              reason: payload.reason,
            }),
          });
          const responsePayload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setBusy(false);

          if (!res.ok) {
            showToast({ message: responsePayload.error ?? "השבת המטופל לפעיל נכשלה." });
            return;
          }

          showToast({ message: "המטופל הושב למצב פעיל" });
          setOpen(false);
          router.refresh();
        }}
      />
    </section>
  );
}
