"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useQuickActions } from "@/components/QuickActions";

export function ArchiveReceiptButton({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function archive() {
    setArchiving(true);
    const res = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
    setArchiving(false);
    if (!res.ok) {
      showToast({ message: "מחיקת קבלה נכשלה." });
      return;
    }
    showToast({ message: "הקבלה נמחקה" });
    setConfirmOpen(false);
    router.push("/receipts");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="app-btn app-btn-secondary text-rose-700 hover:bg-rose-50"
      >
        מחק
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="מחיקת קבלה"
        message="האם למחוק את הקבלה? הקבלה תועבר לארכיון."
        confirmLabel="מחק קבלה"
        cancelLabel="ביטול"
        busy={archiving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          void archive();
        }}
      />
    </>
  );
}
