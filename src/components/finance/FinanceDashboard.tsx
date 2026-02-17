"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ReceiptRow = {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  patientId: string;
  patientName: string;
  amountNis: number;
  allocations: number;
};

type ExpenseRow = {
  id: string;
  title: string;
  category: string | null;
  amountNis: number;
  occurredAt: string;
};

export function FinanceDashboard({ receipts, expenses }: { receipts: ReceiptRow[]; expenses: ExpenseRow[] }) {
  const [monthFilter, setMonthFilter] = useState("CURRENT");
  const [patientFilter, setPatientFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"PATIENTS" | "CLINIC">("PATIENTS");

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const months = useMemo(() => {
    const set = new Set(receipts.map((r) => r.issuedAt.slice(0, 7)));
    expenses.forEach((e) => set.add(e.occurredAt.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [receipts, expenses]);

  const patients = useMemo(() => {
    const set = new Map<string, string>();
    receipts.forEach((r) => set.set(r.patientId, r.patientName));
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [receipts]);

  const resolvedMonth = monthFilter === "CURRENT" ? currentMonth : monthFilter;

  const filteredReceipts = receipts.filter((r) => {
    if (resolvedMonth !== "ALL" && !r.issuedAt.startsWith(resolvedMonth)) return false;
    if (viewMode === "PATIENTS" && patientFilter !== "ALL" && r.patientId !== patientFilter) return false;
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (resolvedMonth !== "ALL" && !e.occurredAt.startsWith(resolvedMonth)) return false;
    return true;
  });

  const totalIncome = filteredReceipts.reduce((sum, r) => sum + r.amountNis, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amountNis, 0);
  const incomeByPatient = (() => {
    const map = new Map<string, number>();
    filteredReceipts.forEach((r) => map.set(r.patientName, (map.get(r.patientName) ?? 0) + r.amountNis));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  })();

  const incomeByMonth = (() => {
    const map = new Map<string, number>();
    filteredReceipts.forEach((r) => {
      const key = r.issuedAt.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + r.amountNis);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const expenseByMonth = (() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const key = e.occurredAt.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + e.amountNis);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const chartSeries = (() => {
    if (resolvedMonth !== "ALL") {
      const dayMap = new Map<string, { income: number; expense: number }>();
      filteredReceipts.forEach((r) => {
        const key = r.issuedAt.slice(0, 10);
        const entry = dayMap.get(key) ?? { income: 0, expense: 0 };
        entry.income += r.amountNis;
        dayMap.set(key, entry);
      });
      filteredExpenses.forEach((e) => {
        const key = e.occurredAt.slice(0, 10);
        const entry = dayMap.get(key) ?? { income: 0, expense: 0 };
        entry.expense += e.amountNis;
        dayMap.set(key, entry);
      });
      return Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-10);
    }

    const monthMap = new Map<string, { income: number; expense: number }>();
    incomeByMonth.forEach(([key, val]) => monthMap.set(key, { income: val, expense: 0 }));
    expenseByMonth.forEach(([key, val]) => {
      const entry = monthMap.get(key) ?? { income: 0, expense: 0 };
      entry.expense = val;
      monthMap.set(key, entry);
    });
    return Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const maxValue = Math.max(
    1,
    ...chartSeries.flatMap(([, entry]) => [entry.income, entry.expense])
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4">
      <section className="app-section">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">כספים</h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/receipts/new" className="rounded-lg border border-accent/25 bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent">
              קבלה חדשה
            </Link>
            <button
              type="button"
              onClick={() => alert("טופס הוצאות יתווסף בשלב הבא")}
              className="rounded-lg border border-black/20 bg-white px-2.5 py-1.5 text-xs"
            >
              הוצאה חדשה
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white/90 px-3 py-2">
              <div className="text-xs text-muted">סה״כ הכנסות</div>
              <div className="text-lg font-semibold">₪{totalIncome.toLocaleString("he-IL")}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/90 px-3 py-2">
              <div className="text-xs text-muted">סה״כ הוצאות</div>
              <div className="text-lg font-semibold">₪{totalExpenses.toLocaleString("he-IL")}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="app-select"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="בחירת תקופה"
            >
              <option value="CURRENT">חודש נוכחי</option>
              <option value="ALL">כל השנה</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              className="app-select"
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              aria-label="בחירת מטופל"
            >
              <option value="ALL">כל המטופלים</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "CLINIC"
                  ? "border-accent/30 bg-accent-soft text-accent"
                  : "border-black/20 bg-white"
              }`}
              onClick={() => {
                const next = viewMode === "CLINIC" ? "PATIENTS" : "CLINIC";
                setViewMode(next);
                if (next === "CLINIC") {
                  setPatientFilter("ALL");
                  setMonthFilter("ALL");
                }
              }}
            >
              מבט על הקליניקה
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <section className="app-section">
          <h2 className="mb-2 text-sm font-semibold">פילוח לפי מטופלים</h2>
          <div className="flex items-center gap-3">
            <div
              className="size-36 rounded-full"
              style={{
                background: `conic-gradient(${incomeByPatient
                  .map(([, value], index) => {
                    const start = incomeByPatient.slice(0, index).reduce((sum, [, v]) => sum + v, 0);
                    const end = start + value;
                    const startPct = Math.round((start / totalIncome) * 100);
                    const endPct = Math.round((end / totalIncome) * 100);
                    const colors = ["#7aa6a2", "#d7b58b", "#a9c3d8", "#9bb7a0", "#8fa2b6", "#c9a9a2"];
                    return `${colors[index % colors.length]} ${startPct}% ${endPct}%`;
                  })
                  .join(", ") || "#e6dfd3 0 100%"})`,
                border: "1px solid rgba(58,45,33,0.2)",
              }}
            />
            <div className="space-y-1 text-xs">
              {incomeByPatient.map(([name, value]) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <span className="text-muted">{name}</span>
                  <span className="tabular-nums">₪{value.toLocaleString("he-IL")}</span>
                </div>
              ))}
              {incomeByPatient.length === 0 ? <div className="text-muted">אין נתונים להצגה</div> : null}
            </div>
          </div>
        </section>

        <section className="app-section">
          <h2 className="mb-2 text-sm font-semibold">הכנסות והוצאות לאורך זמן</h2>
          <div className="flex items-end gap-2">
            {chartSeries.map(([label, entry]) => (
              <div key={label} className="flex min-w-12 flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-full bg-accent"
                    style={{ height: `${Math.max(8, (entry.income / maxValue) * 120)}px` }}
                    title={`הכנסות ₪${entry.income.toLocaleString("he-IL")}`}
                  />
                  <div
                    className="w-3 rounded-full bg-[#d7b58b]"
                    style={{ height: `${Math.max(6, (entry.expense / maxValue) * 120)}px` }}
                    title={`הוצאות ₪${entry.expense.toLocaleString("he-IL")}`}
                  />
                </div>
                <div className="text-[11px] text-muted">
                  {label.slice(resolvedMonth === "ALL" ? 2 : 8)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-accent" /> הכנסות
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#d7b58b]" /> הוצאות
            </span>
          </div>
        </section>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="app-section">
          <h2 className="mb-2 text-sm font-semibold">קבלות שהופקו</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-right text-xs text-muted">
                  <th className="p-2 font-medium">מס׳ קבלה</th>
                  <th className="p-2 font-medium">תאריך</th>
                  <th className="p-2 font-medium">מטופל</th>
                  <th className="p-2 font-medium">סכום</th>
                  <th className="p-2 font-medium">הקצאות</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="border-b border-black/5">
                    <td className="p-2 font-mono text-xs">
                      <Link href={`/receipts/${receipt.id}`} className="text-accent hover:underline">
                        {receipt.receiptNumber}
                      </Link>
                    </td>
                    <td className="p-2">{new Date(receipt.issuedAt).toLocaleDateString("he-IL")}</td>
                    <td className="max-w-44 truncate p-2">
                      <Link href={`/patients/${receipt.patientId}`} className="text-accent hover:underline">
                        {receipt.patientName}
                      </Link>
                    </td>
                    <td className="p-2">₪{receipt.amountNis}</td>
                    <td className="p-2">
                      <Link href={`/receipts/${receipt.id}`} className="text-accent hover:underline">
                        {receipt.allocations} פגישות
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="app-section">
          <h2 className="mb-2 text-sm font-semibold">הוצאות</h2>
          <div className="space-y-2 text-sm">
            {filteredExpenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between rounded-lg border border-black/10 bg-white/90 px-3 py-2">
                <div>
                  <div className="text-ink">{exp.title}</div>
                  <div className="text-xs text-muted">
                    {new Date(exp.occurredAt).toLocaleDateString("he-IL")}
                    {exp.category ? ` · ${exp.category}` : ""}
                  </div>
                </div>
                <div className="tabular-nums">₪{exp.amountNis}</div>
              </div>
            ))}
            {filteredExpenses.length === 0 ? <div className="text-sm text-muted">אין הוצאות שהוזנו.</div> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
