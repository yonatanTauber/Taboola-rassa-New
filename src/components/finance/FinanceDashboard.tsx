"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuickActions } from "@/components/QuickActions";

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

type UnpaidRow = {
  sessionId: string;
  scheduledAt: string; // ISO UTC
  patientId: string;
  patientName: string;
  feeNis: number;
  paidNis: number;
  outstandingNis: number;
};

function fmtDateShort(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

export function FinanceDashboard({
  receipts,
  expenses,
  unpaidSessions,
}: {
  receipts: ReceiptRow[];
  expenses: ExpenseRow[];
  unpaidSessions: UnpaidRow[];
}) {
  const { showToast } = useQuickActions();
  const [monthFilter, setMonthFilter] = useState("CURRENT");
  const [patientFilter, setPatientFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"PATIENTS" | "CLINIC">("PATIENTS");

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const months = useMemo(() => {
    const set = new Set(receipts.map((r) => r.issuedAt.slice(0, 7)));
    expenses.forEach((e) => set.add(e.occurredAt.slice(0, 7)));
    unpaidSessions.forEach((s) => set.add(s.scheduledAt.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [receipts, expenses, unpaidSessions]);

  const patients = useMemo(() => {
    const map = new Map<string, string>();
    receipts.forEach((r) => map.set(r.patientId, r.patientName));
    unpaidSessions.forEach((s) => map.set(s.patientId, s.patientName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [receipts, unpaidSessions]);

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

  const filteredUnpaid = unpaidSessions.filter((s) => {
    if (resolvedMonth !== "ALL" && !s.scheduledAt.startsWith(resolvedMonth)) return false;
    if (viewMode === "PATIENTS" && patientFilter !== "ALL" && s.patientId !== patientFilter) return false;
    return true;
  });

  const totalIncome = filteredReceipts.reduce((sum, r) => sum + r.amountNis, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amountNis, 0);
  const totalOutstanding = filteredUnpaid.reduce((sum, s) => sum + s.outstandingNis, 0);
  const netProfit = totalIncome - totalExpenses;

  const incomeByPatient = (() => {
    const map = new Map<string, number>();
    filteredReceipts.forEach((r) => map.set(r.patientName, (map.get(r.patientName) ?? 0) + r.amountNis));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
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
      return Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-10);
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

  const maxValue = Math.max(1, ...chartSeries.flatMap(([, entry]) => [entry.income, entry.expense]));

  const CHART_H = 220; // px — max bar height
  const YAXIS_FRACS = [1, 0.75, 0.5, 0.25];
  const PIE_COLORS = ["#7aa6a2", "#d7b58b", "#a9c3d8", "#9bb7a0", "#8fa2b6", "#c9a9a2"];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5">

      {/* ── 1. FILTER BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">כספים</h1>
          <Link
            href="/receipts/new"
            className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
          >
            + קבלה חדשה
          </Link>
          <button
            type="button"
            onClick={() => showToast({ message: "טופס הוצאות יתווסף בשלב הבא" })}
            className="app-btn app-btn-secondary !px-3 !py-1.5 text-xs"
          >
            + הוצאה חדשה
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="app-select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} aria-label="בחירת תקופה">
            <option value="CURRENT">חודש נוכחי</option>
            <option value="ALL">כל השנה</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="app-select" value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)} aria-label="בחירת מטופל">
            <option value="ALL">כל המטופלים</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            type="button"
            className={`app-btn !px-3 !py-1.5 text-xs ${viewMode === "CLINIC" ? "app-btn-primary" : "app-btn-secondary"}`}
            onClick={() => {
              const next = viewMode === "CLINIC" ? "PATIENTS" : "CLINIC";
              setViewMode(next);
              if (next === "CLINIC") { setPatientFilter("ALL"); setMonthFilter("ALL"); }
            }}
          >
            מבט על הקליניקה
          </button>
        </div>
      </div>

      {/* ── 2. KPI CARDS ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* חובות פתוחים */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/80 px-5 py-4">
          <div aria-hidden="true" className="absolute -right-4 -top-4 size-20 rounded-full bg-rose-300 opacity-20" />
          <div className="relative flex items-start justify-between gap-2">
            <span className="text-2xl leading-none" aria-hidden="true">💸</span>
            {filteredUnpaid.length > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {filteredUnpaid.length}
              </span>
            )}
          </div>
          <div className="relative mt-2 text-3xl font-bold tabular-nums text-rose-700">
            ₪{totalOutstanding.toLocaleString("he-IL")}
          </div>
          <div className="relative mt-1 text-xs font-medium text-rose-500">חובות פתוחים</div>
        </div>

        {/* הכנסות */}
        <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-[--accent-soft] to-emerald-50/60 px-5 py-4">
          <div aria-hidden="true" className="absolute -right-4 -top-4 size-20 rounded-full bg-accent opacity-10" />
          <div className="relative">
            <span className="text-2xl font-black leading-none text-accent" aria-hidden="true">↑</span>
          </div>
          <div className="relative mt-2 text-3xl font-bold tabular-nums text-accent">
            ₪{totalIncome.toLocaleString("he-IL")}
          </div>
          <div className="relative mt-1 text-xs font-medium text-accent/70">הכנסות (קבלות)</div>
        </div>

        {/* הוצאות */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 px-5 py-4">
          <div aria-hidden="true" className="absolute -right-4 -top-4 size-20 rounded-full bg-amber-300 opacity-20" />
          <div className="relative">
            <span className="text-2xl font-black leading-none text-amber-600" aria-hidden="true">↓</span>
          </div>
          <div className="relative mt-2 text-3xl font-bold tabular-nums text-amber-700">
            ₪{totalExpenses.toLocaleString("he-IL")}
          </div>
          <div className="relative mt-1 text-xs font-medium text-amber-600/80">הוצאות</div>
        </div>

        {/* רווח נקי */}
        <div className={`relative overflow-hidden rounded-2xl border px-5 py-4 ${
          netProfit >= 0
            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60"
            : "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/60"
        }`}>
          <div aria-hidden="true" className={`absolute -right-4 -top-4 size-20 rounded-full opacity-20 ${netProfit >= 0 ? "bg-emerald-400" : "bg-rose-300"}`} />
          <div className="relative">
            <span className={`text-xl font-black leading-none ${netProfit >= 0 ? "text-emerald-600" : "text-rose-500"}`} aria-hidden="true">
              {netProfit >= 0 ? "✦" : "▼"}
            </span>
          </div>
          <div className={`relative mt-2 text-3xl font-bold tabular-nums ${netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {netProfit < 0 ? "−" : ""}₪{Math.abs(netProfit).toLocaleString("he-IL")}
          </div>
          <div className={`relative mt-1 text-xs font-medium ${netProfit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>רווח נקי</div>
        </div>
      </div>

      {/* ── 3. BAR CHART — full width ── */}
      <section className="app-section">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">הכנסות והוצאות לאורך זמן</h2>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-accent" aria-hidden="true" />
              הכנסות
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-amber-600/70" aria-hidden="true" />
              הוצאות
            </span>
          </div>
        </div>

        {chartSeries.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted">אין נתונים להצגה</div>
        ) : (
          /* dir="ltr" so time axis flows left→right regardless of RTL document */
          <div className="relative" dir="ltr">
            {/* Y-axis grid lines */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-6" aria-hidden="true">
              {YAXIS_FRACS.map((frac) => (
                <div key={frac} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted">
                    ₪{Math.round(maxValue * frac).toLocaleString("he-IL")}
                  </span>
                  <div className="flex-1 border-t border-dashed border-black/10" />
                </div>
              ))}
            </div>

            {/* Bars */}
            <div className="ml-16 flex items-end gap-2" style={{ minHeight: `${CHART_H + 24}px`, paddingBottom: "24px" }}>
              {chartSeries.map(([label, entry]) => (
                <div key={label} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end justify-center gap-1">
                    {/* Income bar */}
                    <div className="relative flex-1">
                      <div
                        className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink/90 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      >
                        הכנסות ₪{entry.income.toLocaleString("he-IL")}
                      </div>
                      <div
                        className="w-full rounded-t-md bg-accent transition-all duration-300"
                        style={{ height: `${Math.max(3, (entry.income / maxValue) * CHART_H)}px` }}
                        title={`הכנסות ₪${entry.income.toLocaleString("he-IL")}`}
                      />
                    </div>
                    {/* Expense bar */}
                    <div className="relative flex-1">
                      <div
                        className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink/90 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      >
                        הוצאות ₪{entry.expense.toLocaleString("he-IL")}
                      </div>
                      <div
                        className="w-full rounded-t-md bg-amber-600/60 transition-all duration-300"
                        style={{ height: `${Math.max(3, (entry.expense / maxValue) * CHART_H)}px` }}
                        title={`הוצאות ₪${entry.expense.toLocaleString("he-IL")}`}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted">
                    {label.slice(resolvedMonth === "ALL" ? 2 : 8)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── 4. חובות פתוחים — card list ── */}
      <section className="app-section">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">חובות פתוחים</h2>
            {filteredUnpaid.length > 0 && (
              <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-bold text-white">
                {filteredUnpaid.length}
              </span>
            )}
          </div>
          {filteredUnpaid.length > 0 && (
            <span className="text-sm font-bold tabular-nums text-rose-700">
              סה״כ ₪{totalOutstanding.toLocaleString("he-IL")}
            </span>
          )}
        </div>

        {filteredUnpaid.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
            <div className="mb-1 text-2xl" aria-hidden="true">✓</div>
            <div className="text-sm font-medium text-emerald-700">אין חובות פתוחים בתקופה זו</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUnpaid.map((row) => (
              <div
                key={row.sessionId}
                className="flex items-center gap-3 rounded-xl border border-rose-100 bg-gradient-to-l from-rose-50/70 to-white/70 px-4 py-3 transition hover:border-rose-200 hover:from-rose-100/60"
              >
                {/* Initial avatar */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-600" aria-hidden="true">
                  {row.patientName.charAt(0)}
                </div>
                {/* Name + date */}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/patients/${row.patientId}`}
                    className="block truncate font-medium text-ink hover:text-accent hover:underline"
                  >
                    {row.patientName}
                  </Link>
                  <div className="text-xs text-muted">
                    {fmtDateShort(row.scheduledAt)}
                    {row.paidNis > 0 && (
                      <span className="ms-2">· שולם ₪{row.paidNis.toLocaleString("he-IL")} מתוך ₪{row.feeNis.toLocaleString("he-IL")}</span>
                    )}
                  </div>
                </div>
                {/* Outstanding amount */}
                <div className="shrink-0 text-end">
                  <div className="text-lg font-bold tabular-nums text-rose-600">
                    ₪{row.outstandingNis.toLocaleString("he-IL")}
                  </div>
                </div>
                {/* CTA */}
                <Link
                  href={`/receipts/new?patientId=${row.patientId}`}
                  className="shrink-0 rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15"
                >
                  הפק קבלה
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. קבלות שהופקו ── */}
      <section className="app-section">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">קבלות שהופקו</h2>
          {filteredReceipts.length > 0 && (
            <span className="text-sm tabular-nums text-muted">
              סה״כ ₪{totalIncome.toLocaleString("he-IL")}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black/8 text-right text-xs text-muted">
                <th className="pb-2 pt-1 pe-4 font-medium">מס׳ קבלה</th>
                <th className="pb-2 pt-1 pe-4 font-medium">תאריך</th>
                <th className="pb-2 pt-1 pe-4 font-medium">מטופל</th>
                <th className="pb-2 pt-1 pe-4 font-medium">סכום</th>
                <th className="pb-2 pt-1 font-medium">הקצאות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="transition hover:bg-accent-soft/30">
                  <td className="py-2.5 pe-4 font-mono text-xs">
                    <Link href={`/receipts/${receipt.id}`} className="text-accent hover:underline">
                      {receipt.receiptNumber}
                    </Link>
                  </td>
                  <td className="py-2.5 pe-4 text-muted">
                    {new Date(receipt.issuedAt).toLocaleDateString("he-IL")}
                  </td>
                  <td className="max-w-44 truncate py-2.5 pe-4">
                    <Link href={`/patients/${receipt.patientId}`} className="text-ink hover:text-accent hover:underline">
                      {receipt.patientName}
                    </Link>
                  </td>
                  <td className="py-2.5 pe-4 tabular-nums font-medium">
                    ₪{receipt.amountNis.toLocaleString("he-IL")}
                  </td>
                  <td className="py-2.5">
                    <Link href={`/receipts/${receipt.id}`} className="text-xs text-muted hover:text-accent hover:underline">
                      {receipt.allocations} פגישות
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredReceipts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted">אין קבלות בתקופה זו</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 6. פילוח עוגה + הוצאות ── */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">

        {/* עוגה */}
        <section className="app-section">
          <h2 className="mb-3 text-base font-semibold">פילוח לפי מטופלים</h2>
          {incomeByPatient.length === 0 ? (
            <div className="py-4 text-sm text-muted">אין נתונים להצגה</div>
          ) : (
            <div className="flex items-center gap-5">
              <div
                className="size-40 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(${incomeByPatient
                    .map(([, value], index) => {
                      const start = incomeByPatient.slice(0, index).reduce((sum, [, v]) => sum + v, 0);
                      const end = start + value;
                      const startPct = Math.round((start / totalIncome) * 100);
                      const endPct = Math.round((end / totalIncome) * 100);
                      return `${PIE_COLORS[index % PIE_COLORS.length]} ${startPct}% ${endPct}%`;
                    })
                    .join(", ")})`,
                  border: "1.5px solid rgba(58,45,33,0.15)",
                  boxShadow: "inset 0 2px 10px rgba(0,0,0,0.07)",
                }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                {incomeByPatient.map(([name, value], idx) => {
                  const pct = totalIncome > 0 ? Math.round((value / totalIncome) * 100) : 0;
                  const bgClasses = ["bg-[#7aa6a2]", "bg-[#d7b58b]", "bg-[#a9c3d8]", "bg-[#9bb7a0]", "bg-[#8fa2b6]", "bg-[#c9a9a2]"];
                  return (
                    <div key={name} className="flex items-center gap-2 text-xs">
                      <span className={`size-2 shrink-0 rounded-full ${bgClasses[idx % bgClasses.length]}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-muted">{name}</span>
                      <span className="shrink-0 tabular-nums font-medium">₪{value.toLocaleString("he-IL")}</span>
                      <span className="shrink-0 text-muted">({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* הוצאות */}
        <section className="app-section">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">הוצאות</h2>
            {filteredExpenses.length > 0 && (
              <span className="text-sm tabular-nums text-muted">
                סה״כ ₪{totalExpenses.toLocaleString("he-IL")}
              </span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center gap-3 rounded-xl border border-black/8 bg-white/60 px-3 py-2.5 transition hover:border-black/15"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{exp.title}</div>
                  <div className="text-xs text-muted">
                    {new Date(exp.occurredAt).toLocaleDateString("he-IL")}
                    {exp.category ? ` · ${exp.category}` : ""}
                  </div>
                </div>
                <div className="shrink-0 tabular-nums font-semibold text-amber-700">
                  ₪{exp.amountNis.toLocaleString("he-IL")}
                </div>
              </div>
            ))}
            {filteredExpenses.length === 0 && (
              <p className="text-sm text-muted">אין הוצאות שהוזנו.</p>
            )}
          </div>
        </section>
      </section>

    </main>
  );
}
