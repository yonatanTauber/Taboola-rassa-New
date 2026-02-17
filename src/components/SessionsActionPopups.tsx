"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type PatientOption = {
  id: string;
  name: string;
};

export function SessionsActionPopups({ patients }: { patients: PatientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<"session" | "task" | null>(null);
  const [savedMessage, setSavedMessage] = useState("");

  async function submitSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const payload = {
      patientId: String(fd.get("patientId") ?? ""),
      scheduledAt: String(fd.get("scheduledAt") ?? ""),
      feeNis: String(fd.get("feeNis") ?? ""),
      location: String(fd.get("location") ?? ""),
    };

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSavedMessage("פגישה נשמרה בהצלחה.");
      setOpen(null);
      router.refresh();
    }
  }

  async function submitTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const payload = {
      title: String(fd.get("title") ?? ""),
      dueAt: String(fd.get("dueAt") ?? ""),
      patientId: String(fd.get("patientId") ?? ""),
    };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSavedMessage("משימה נשמרה בהצלחה.");
      setOpen(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {savedMessage ? (
        <div className="rounded-xl border border-accent/25 bg-accent-soft px-3 py-2 text-sm text-accent">
          {savedMessage}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen("session")}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium transition hover:bg-accent-soft"
        >
          פגישה חדש
        </button>
        <button
          type="button"
          onClick={() => setOpen("task")}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium transition hover:bg-accent-soft"
        >
          משימה חדשה
        </button>
      </div>

      <ActionModal open={open === "session"} onClose={() => setOpen(null)} title="פגישה חדש">
        <form onSubmit={submitSession} className="space-y-2 text-sm">
          <select required name="patientId" className="w-full rounded-lg border border-black/10 px-3 py-2">
            <option value="">בחר מטופל</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input required type="datetime-local" name="scheduledAt" className="w-full rounded-lg border border-black/10 px-3 py-2" />
          <input type="number" min="0" name="feeNis" placeholder="מחיר (₪)" className="w-full rounded-lg border border-black/10 px-3 py-2" />
          <input name="location" placeholder="מיקום (קליניקה / אונליין)" className="w-full rounded-lg border border-black/10 px-3 py-2" />
          <button className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-medium transition hover:bg-accent-soft">
            שמירת פגישה
          </button>
        </form>
      </ActionModal>

      <ActionModal open={open === "task"} onClose={() => setOpen(null)} title="משימה חדשה">
        <form onSubmit={submitTask} className="space-y-2 text-sm">
          <input required name="title" placeholder="תיאור משימה" className="w-full rounded-lg border border-black/10 px-3 py-2" />
          <input type="date" name="dueAt" className="w-full rounded-lg border border-black/10 px-3 py-2" />
          <select name="patientId" className="w-full rounded-lg border border-black/10 px-3 py-2">
            <option value="">משימה כללית לקליניקה</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-medium transition hover:bg-accent-soft">
            שמירת משימה
          </button>
        </form>
      </ActionModal>
    </div>
  );
}

function ActionModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full rounded-2xl border border-black/10 bg-white p-4 shadow-2xl transition-all ${
          fullscreen ? "m-3 h-[calc(100vh-24px)] max-w-none" : "max-w-lg"
        }`}
      >
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="absolute left-3 top-3 rounded-md border border-black/10 px-2 py-1 text-xs hover:bg-accent-soft"
          aria-label="הגדל למסך מלא"
        >
          {fullscreen ? "הקטן" : "הגדל"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md border border-black/10 px-2 py-1 text-xs hover:bg-accent-soft"
          aria-label="סגור"
        >
          סגור
        </button>
        <h3 className="mb-4 text-lg font-semibold text-ink">{title}</h3>
        <div className={fullscreen ? "h-[calc(100%-52px)] overflow-auto" : ""}>{children}</div>
      </div>
    </div>
  );
}
