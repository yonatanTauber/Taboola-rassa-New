"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UnarchiveButton({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUnarchive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/unarchive`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "הפעלה מחדש נכשלה.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleUnarchive()}
      disabled={loading}
      className="app-btn app-btn-secondary whitespace-nowrap !px-3 !py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "מפעיל..." : "הפעל מחדש"}
    </button>
  );
}
