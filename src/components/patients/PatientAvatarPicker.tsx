"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuickActions } from "@/components/QuickActions";
import { PATIENT_AVATARS } from "@/lib/patient-avatar";

export function PatientAvatarPicker({ patientId, value }: { patientId: string; value: string }) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function updateAvatar(avatarKey: string) {
    if (saving || avatarKey === value) return;
    setSaving(true);
    const res = await fetch(`/api/patients/${patientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarKey }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast({ message: "עדכון אייקון נכשל" });
      return;
    }
    showToast({ message: "אייקון המטופל עודכן" });
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-2xl border border-black/12 bg-white px-3 py-2 text-3xl"
        title="בחירת אייקון מטופל"
      >
        {PATIENT_AVATARS.find((item) => item.key === value)?.emoji ?? "🧑"}
      </button>
      {open ? (
        <div className="absolute right-0 top-14 z-20 grid w-64 grid-cols-5 gap-1 rounded-xl border border-black/12 bg-white p-2 shadow-sm">
          {PATIENT_AVATARS.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={saving}
              onClick={() => updateAvatar(item.key)}
              className={`rounded-lg border px-2 py-1 text-lg transition ${
                value === item.key ? "border-accent bg-accent-soft" : "border-black/12 bg-white hover:bg-black/[0.02]"
              }`}
              title="בחירת אייקון"
            >
              {item.emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
