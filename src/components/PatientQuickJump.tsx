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
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-right text-sm transition ${open ? "border-accent bg-accent-soft text-accent" : "border-black/16 bg-white text-ink hover:bg-accent-soft/60"}`}
      >
        <span className="truncate">בחירת מטופל</span>
        <span className="text-xs">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[300] rounded-xl border border-black/16 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="p-2 border-b border-black/8">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש מטופל…"
              className="app-field text-sm"
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  router.push(`/patients/${p.id}`);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-ink transition hover:bg-accent-soft"
              >
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[10px] font-semibold text-muted">
                  {p.name.charAt(0)}
                </span>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            {!filtered.length ? <div className="px-3 py-3 text-center text-xs text-muted">לא נמצאו מטופלים</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
