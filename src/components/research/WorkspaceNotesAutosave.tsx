"use client";

import { useEffect, useMemo, useState } from "react";

export function WorkspaceNotesAutosave({
  documentId,
  initialValue,
}: {
  documentId: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const changed = useMemo(() => value !== initialValue, [value, initialValue]);

  useEffect(() => {
    if (!changed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("saving");
      try {
        const res = await fetch(`/api/research/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceNotes: value }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Save failed with status ${res.status}`);
        }
        setStatus("saved");
        window.setTimeout(() => {
          setStatus((current) => (current === "saved" ? "idle" : current));
        }, 1300);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      }
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [changed, documentId, value]);

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">מלל חופשי קבוע על הפריט</h2>
        <span className="text-xs text-muted">
          {status === "saving"
            ? "שומר..."
            : status === "saved"
              ? "נשמר"
              : status === "error"
                ? "שגיאה בשמירה"
                : "שמירה אוטומטית"}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("saving");
        }}
        placeholder="מקום כתיבה חופשי שנשמר אוטומטית גם אם יוצאים מהדף"
        className="app-textarea min-h-64"
      />
    </section>
  );
}
