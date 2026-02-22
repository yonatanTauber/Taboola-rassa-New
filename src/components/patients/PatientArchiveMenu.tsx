"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuickActions } from "@/components/QuickActions";
import { PatientStatusDialog } from "@/components/patients/PatientStatusDialog";

export function PatientArchiveMenu({
  patientId,
  editPatientHref,
  editLayoutHref,
  intakeHref,
  isInactive = false,
}: {
  patientId: string;
  editPatientHref: string;
  editLayoutHref: string;
  intakeHref: string;
  isInactive?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [open, setOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg border border-black/12 bg-white px-2.5 py-1 text-sm">
        ⋯
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-20 min-w-48 rounded-lg border border-black/12 bg-white p-2 shadow-sm">
          <Link
            href={editPatientHref}
            onClick={() => setOpen(false)}
            className="block w-full rounded-md px-2 py-1 text-right text-sm hover:bg-black/[0.04]"
          >
            עריכת מטופל
          </Link>
          <Link
            href={intakeHref}
            onClick={() => setOpen(false)}
            className="mt-1 block w-full rounded-md px-2 py-1 text-right text-sm hover:bg-black/[0.04]"
          >
            עריכת אינטייק
          </Link>
          <Link
            href={editLayoutHref}
            onClick={() => setOpen(false)}
            className="mt-1 block w-full rounded-md px-2 py-1 text-right text-sm hover:bg-black/[0.04]"
          >
            עריכת הדף
          </Link>
          {!isInactive ? (
            <button
              type="button"
              className="mt-1 w-full rounded-md px-2 py-1 text-right text-sm text-danger hover:bg-danger/10"
              onClick={async () => {
                setOpen(false);
                setStatusDialogOpen(true);
              }}
            >
              העברה למטופל לא פעיל
            </button>
          ) : null}
        </div>
      ) : null}

      <PatientStatusDialog
        open={statusDialogOpen}
        mode="setInactive"
        busy={savingStatus}
        onCancel={() => setStatusDialogOpen(false)}
        onSubmit={async (payload) => {
          setSavingStatus(true);
          const res = await fetch(`/api/patients/${patientId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "set_inactive",
              inactiveAt: payload.date,
              reason: payload.reason || null,
              cancelFutureSessions: payload.cancelFutureSessions,
              closeOpenTasks: payload.closeOpenTasks,
            }),
          });
          const responsePayload = (await res.json().catch(() => ({}))) as {
            error?: string;
            canceledSessionsCount?: number;
            closedTasksCount?: number;
          };
          setSavingStatus(false);

          if (!res.ok) {
            showToast({ message: responsePayload.error ?? "העברה למטופל לא פעיל נכשלה" });
            return;
          }

          const canceledSessions = Number(responsePayload.canceledSessionsCount ?? 0);
          const closedTasks = Number(responsePayload.closedTasksCount ?? 0);
          showToast({
            message: `המטופל הועבר ללא פעיל${canceledSessions || closedTasks ? ` · בוטלו ${canceledSessions} פגישות ונסגרו ${closedTasks} משימות` : ""}`,
          });
          setStatusDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
