"use client";

import { useRouter } from "next/navigation";
import { useQuickActions } from "@/components/QuickActions";

export function ArchiveReceiptButton({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const { showToast } = useQuickActions();

  async function archive() {
    const ok = window.confirm("למחוק את הקבלה? (הקבלה תועבר לארכיון)");
    if (!ok) return;
    const res = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast({ message: "מחיקת קבלה נכשלה." });
      return;
    }
    showToast({ message: "הקבלה נמחקה" });
    router.push("/receipts");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={archive}
      className="app-btn app-btn-secondary text-rose-700 hover:bg-rose-50"
    >
      מחק
    </button>
  );
}
