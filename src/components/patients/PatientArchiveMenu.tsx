"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useQuickActions } from "@/components/QuickActions";

export function PatientArchiveMenu({
  patientId,
  editPatientHref,
  editLayoutHref,
  intakeHref,
}: {
  patientId: string;
  editPatientHref: string;
  editLayoutHref: string;
  intakeHref: string;
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [open, setOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg border border-black/12 bg-white px-2.5 py-1 text-sm">
        ⋯
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-20 min-w-44 rounded-lg border border-black/12 bg-white p-2 shadow-sm">
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
          <button
            type="button"
            className="mt-1 w-full rounded-md px-2 py-1 text-right text-sm text-danger hover:bg-danger/10"
            onClick={async () => {
              setOpen(false);
              setArchiveOpen(true);
            }}
          >
            העברה לארכיון
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        open={archiveOpen}
        title="להעביר מטופל לארכיון?"
        message="ניתן יהיה לראות את המטופל בדף הארכיון."
        confirmLabel="העבר לארכיון"
        cancelLabel="ביטול"
        busy={archiving}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={async () => {
          setArchiving(true);
          const res = await fetch(`/api/patients/${patientId}`, { method: "DELETE" });
          setArchiving(false);
          if (!res.ok) {
            showToast({ message: "העברה לארכיון נכשלה" });
            return;
          }
          showToast({ message: "המטופל הועבר לארכיון" });
          setArchiveOpen(false);
          router.push("/patients");
          router.refresh();
        }}
      />
    </div>
  );
}
