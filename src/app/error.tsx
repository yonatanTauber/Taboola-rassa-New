"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 py-12 text-center">
      <h2 className="text-lg font-semibold text-ink">אירעה שגיאה</h2>
      <p className="text-sm text-muted">
        {error.message || "שגיאה לא צפויה. נסה שוב."}
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="app-btn app-btn-primary">
          נסה שוב
        </button>
        <Link href="/" className="app-btn app-btn-secondary">
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
