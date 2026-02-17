"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuickActions } from "@/components/QuickActions";

type GuidanceRow = {
  id: string;
  title: string;
  scheduledAt: string;
  status: "ACTIVE" | "COMPLETED";
  feeNis: number | null;
  updatedAt: string;
  patient: { id: string; name: string };
  instructor: { id: string; fullName: string } | null;
  sessionsCount: number;
};

type PatientOption = { id: string; name: string };
type InstructorOption = { id: string; fullName: string };

type SortMode = "UPDATED_DESC" | "TITLE_ASC" | "FEE_DESC" | "COMPLETED_AT";

export function GuidanceWorkspace({
  rows,
  patients,
  instructors,
}: {
  rows: GuidanceRow[];
  patients: PatientOption[];
  instructors: InstructorOption[];
}) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [patientFilter, setPatientFilter] = useState("ALL");
  const [instructorFilter, setInstructorFilter] = useState("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("UPDATED_DESC");
  const [creating, setCreating] = useState(false);

  const [newPatientId, setNewPatientId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newInstructorId, setNewInstructorId] = useState("");
  const [newFeeNis, setNewFeeNis] = useState("");
  const [newScheduledAt, setNewScheduledAt] = useState("");

  const filtered = useMemo(() => {
    const base = rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (patientFilter !== "ALL" && row.patient.id !== patientFilter) return false;
      if (instructorFilter === "NONE" && row.instructor) return false;
      if (instructorFilter !== "ALL" && instructorFilter !== "NONE" && row.instructor?.id !== instructorFilter) return false;
      const text = `${row.title} ${row.patient.name} ${row.instructor?.fullName ?? ""}`.toLowerCase();
      return text.includes(q.trim().toLowerCase());
    });

    const copy = [...base];
    copy.sort((a, b) => {
      if (sortMode === "TITLE_ASC") return a.title.localeCompare(b.title, "he");
      if (sortMode === "FEE_DESC") return (b.feeNis ?? 0) - (a.feeNis ?? 0);
      if (sortMode === "COMPLETED_AT") {
        if (a.status === "COMPLETED" && b.status !== "COMPLETED") return -1;
        if (a.status !== "COMPLETED" && b.status === "COMPLETED") return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return copy;
  }, [rows, q, statusFilter, patientFilter, instructorFilter, sortMode]);

  async function createGuidance() {
    if (!newPatientId) return;
    setCreating(true);
    const res = await fetch("/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: newPatientId,
        title: newTitle,
        instructorId: newInstructorId || null,
        feeNis: newFeeNis.trim() ? Number(newFeeNis) : null,
        scheduledAt: newScheduledAt || null,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      showToast({ message: "יצירת הדרכה נכשלה" });
      return;
    }
    const payload = (await res.json()) as { guidanceId: string };
    router.push(`/guidance/${payload.guidanceId}`);
  }

  return (
    <main className="space-y-4">
      <section className="app-section">
        <h1 className="text-xl font-semibold">הדרכות</h1>
        <p className="text-sm text-muted">מודול הדרכה חדש עם קישור למטופל, מדריך, פגישות והוצאות קליניקה.</p>
      </section>

      <section className="app-section space-y-2">
        <h2 className="text-sm font-semibold">יצירת הדרכה חדשה</h2>
        <div className="grid gap-2 md:grid-cols-5">
          <select
            value={newPatientId}
            onChange={(e) => setNewPatientId(e.target.value)}
            className="app-select"
            aria-label="בחירת מטופל להדרכה חדשה"
          >
            <option value="">בחר מטופל (חובה)</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>

          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="app-field"
            placeholder="כותרת הדרכה"
            aria-label="כותרת הדרכה"
          />

          <select
            value={newInstructorId}
            onChange={(e) => setNewInstructorId(e.target.value)}
            className="app-select"
            aria-label="בחירת מדריך"
          >
            <option value="">ללא מדריך</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.fullName}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            value={newFeeNis}
            onChange={(e) => setNewFeeNis(e.target.value)}
            className="app-field"
            placeholder="עלות הדרכה ₪"
            aria-label="עלות הדרכה בשקלים"
          />

          <input
            type="datetime-local"
            value={newScheduledAt}
            onChange={(e) => setNewScheduledAt(e.target.value)}
            className="app-field"
            aria-label="תאריך הדרכה"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!newPatientId || creating}
            onClick={createGuidance}
          >
            {creating ? "יוצר..." : "צור הדרכה"}
          </button>
        </div>
      </section>

      <section className="app-section space-y-3">
        <div className="grid gap-2 md:grid-cols-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="app-field"
            placeholder="חיפוש הדרכות"
            aria-label="חיפוש הדרכות"
          />

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="app-select" aria-label="סינון לפי סטטוס">
            <option value="ALL">כל הסטטוסים</option>
            <option value="ACTIVE">פעילה</option>
            <option value="COMPLETED">הושלמה</option>
          </select>

          <select value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)} className="app-select" aria-label="סינון לפי מטופל">
            <option value="ALL">כל המטופלים</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>

          <select value={instructorFilter} onChange={(e) => setInstructorFilter(e.target.value)} className="app-select" aria-label="סינון לפי מדריך">
            <option value="ALL">כל המדריכים</option>
            <option value="NONE">ללא מדריך</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.fullName}
              </option>
            ))}
          </select>

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="app-select" aria-label="מיון">
            <option value="UPDATED_DESC">מיון: עודכן לאחרונה</option>
            <option value="TITLE_ASC">מיון: כותרת א-ב</option>
            <option value="FEE_DESC">מיון: עלות גבוהה לנמוכה</option>
            <option value="COMPLETED_AT">מיון: הושלמו בראש</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-right text-xs text-muted">
                <th className="p-2 font-medium">כותרת</th>
                <th className="p-2 font-medium">מטופל</th>
                <th className="p-2 font-medium">מדריך</th>
                <th className="p-2 font-medium">מועד הדרכה</th>
                <th className="p-2 font-medium">סטטוס</th>
                <th className="p-2 font-medium">עלות</th>
                <th className="p-2 font-medium">פגישות</th>
                <th className="p-2 font-medium">עודכן</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.02]">
                  <td className="p-2">
                    <Link href={`/guidance/${row.id}`} className="font-medium text-accent hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="p-2">{row.patient.name}</td>
                  <td className="p-2">{row.instructor?.fullName ?? "—"}</td>
                  <td className="p-2">{row.scheduledAt ? new Date(row.scheduledAt).toLocaleString("he-IL") : "—"}</td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td className="p-2">{row.feeNis ? `₪${row.feeNis.toLocaleString("he-IL")}` : "—"}</td>
                  <td className="p-2">{row.sessionsCount}</td>
                  <td className="p-2">{new Date(row.updatedAt).toLocaleString("he-IL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? <div className="mt-2 text-sm text-muted">אין הדרכות שתואמות לסינון.</div> : null}
        </div>
      </section>
    </main>
  );
}

function statusLabel(status: GuidanceRow["status"]) {
  return status === "COMPLETED" ? "הושלמה" : "פעילה";
}

function statusTone(status: GuidanceRow["status"]) {
  return status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
}
