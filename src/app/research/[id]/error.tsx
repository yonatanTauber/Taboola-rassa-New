"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ResearchDocumentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Research page error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 py-12 text-center">
      <h2 className="text-lg font-semibold text-ink">שגיאה בטעינת מסמך המחקר</h2>
      <p className="text-sm text-muted">
        {error.message || "לא ניתן לטעון את הפריט. נסה שוב."}
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="app-btn app-btn-primary">
          נסה שוב
        </button>
        <Link href="/research" className="app-btn app-btn-secondary">
          חזרה למרחב המחקר
        </Link>
      </div>
    </div>
  );
}
