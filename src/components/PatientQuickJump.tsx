"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = { id: string; name: string };

export function PatientQuickJump({ patients }: { patients: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const filtered = patients.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!rootRef.current || !target) return;
      if (rootRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full max-w-[260px] flex-none">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-black/16 bg-white px-3 py-2 text-right text-sm text-ink transition hover:bg-accent-soft"
      >
        <span className="truncate">בחירת מטופל</span>
        <span className="text-xs text-muted">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-56 overflow-auto rounded-xl border border-black/16 bg-white p-2 shadow-xl">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מטופל"
            className="app-field mb-2"
          />
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/patients/${p.id}`);
              }}
              className="block w-full rounded-lg px-3 py-2 text-right text-sm text-ink transition hover:bg-accent-soft"
            >
              {p.name}
            </button>
          ))}
          {!filtered.length ? <div className="px-3 py-2 text-xs text-muted">לא נמצאו מטופלים.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
