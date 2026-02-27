"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { SearchResult } from "@/app/api/search/route";

const TYPE_LABELS: Record<string, string> = {
  patient: "מטופל",
  task: "משימה",
  guidance: "הדרכה",
  research: "מחקר",
  note: "פתק",
  receipt: "קבלה",
  session: "פגישה",
};

const TYPE_COLORS: Record<string, string> = {
  patient: "bg-blue-100 text-blue-700",
  task: "bg-amber-100 text-amber-700",
  guidance: "bg-violet-100 text-violet-700",
  research: "bg-emerald-100 text-emerald-700",
  note: "bg-orange-100 text-orange-700",
  receipt: "bg-teal-100 text-teal-700",
  session: "bg-indigo-100 text-indigo-700",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const debouncedQuery = useDebounce(query, 220);

  // Close on route change
  useEffect(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, [pathname]);

  // Fetch results
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data: { results: SearchResult[] }) => {
        if (!cancelled) {
          setResults(data.results ?? []);
          setActiveIndex(-1);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const result = results[activeIndex];
        if (result) {
          window.location.href = result.href;
        }
      }
    },
    [open, results, activeIndex],
  );

  const showDropdown = open && (query.length >= 2);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute right-2.5 text-muted">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-60">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="חיפוש... (⌘K)"
          className="w-44 rounded-xl border border-black/14 bg-white/90 py-1.5 pr-8 pl-3 text-sm text-ink placeholder:text-muted/60 transition-[width] focus:w-56 focus:outline-none focus:ring-1 focus:ring-accent/40"
          aria-label="חיפוש כללי"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {loading && (
          <span className="pointer-events-none absolute left-2.5 animate-pulse text-muted">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="14" />
            </svg>
          </span>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute left-0 top-full z-[200] mt-1 w-72 overflow-hidden rounded-xl border border-black/12 bg-white shadow-2xl"
          role="listbox"
        >
          {results.length === 0 && !loading && query.length >= 2 ? (
            <div className="px-4 py-3 text-sm text-muted">לא נמצאו תוצאות</div>
          ) : (
            <ul className="py-1">
              {results.map((result, i) => (
                <li key={`${result.type}-${result.id}`} role="option" aria-selected={i === activeIndex}>
                  <Link
                    href={result.href}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex items-center gap-3 px-3 py-2 text-sm transition ${
                      i === activeIndex ? "bg-accent-soft" : "hover:bg-black/[0.025]"
                    }`}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[result.type] ?? "bg-black/[0.04] text-muted"}`}
                    >
                      {TYPE_LABELS[result.type] ?? result.type}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{result.title}</span>
                      {result.subtitle && (
                        <span className="block truncate text-xs text-muted">{result.subtitle}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
