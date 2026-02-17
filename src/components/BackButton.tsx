"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="inline-flex size-10 items-center justify-center rounded-full border border-accent/25 bg-accent-soft text-2xl font-semibold text-accent shadow-sm transition hover:brightness-[0.98]"
      aria-label="חזרה"
      title="חזרה"
    >
      <span aria-hidden>←</span>
    </button>
  );
}
