"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
};

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "בחר…",
  searchable = false,
  className = "",
  disabled = false,
  required,
  name,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset search when closing
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Hidden input for form compatibility */}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-right text-sm transition
          ${disabled ? "cursor-not-allowed opacity-50 bg-black/[0.04] border-black/10" : ""}
          ${open
            ? "border-accent bg-accent-soft text-accent"
            : "border-black/16 bg-white text-ink hover:bg-accent-soft/60"}
        `}
      >
        <span className={`truncate ${!selected ? "text-muted" : ""}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="ms-2 shrink-0 text-xs text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[300] rounded-xl border border-black/16 bg-white shadow-2xl ring-1 ring-black/5">
          {searchable && (
            <div className="border-b border-black/8 p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש…"
                className="app-field text-sm"
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm transition hover:bg-accent-soft
                  ${opt.value === value ? "bg-accent-soft/60 font-medium text-accent" : "text-ink"}`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <span className="ms-auto shrink-0 text-accent text-xs">✓</span>}
              </button>
            ))}
            {!filtered.length && (
              <div className="px-3 py-3 text-center text-xs text-muted">לא נמצאו אפשרויות</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
