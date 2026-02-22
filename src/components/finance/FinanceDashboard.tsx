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
  // Client-side — browser uses local timezone automatically
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
      {/* Header */}
      <section className="app-section">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">כספים</h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/receipts/new" className="rounded-lg border border-accent/25 bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent">
              קבלה חדשה
            </Link>
            <button
              type="button"
              onClick={() => showToast({ message: "טופס הוצאות יתווסף בשלב הבא" })}
              className="app-btn app-btn-secondary !px-2.5 !py-1.5 text-xs"
            >
              הוצאה חדשה
            </button>
          </div>
        </div>

        {/* KPIs — 4 cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* חובות פתוחים */}
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <div className="mb-0.5 flex items-center justify-between">
              <div className="text-xs text-rose-600">חובות פתוחים</div>
              {filteredUnpaid.length > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {filteredUnpaid.length}
                </span>
              )}
            </div>
            <div className="text-lg font-semibold text-rose-700">
              ₪{totalOutstanding.toLocaleString("he-IL")}
            </div>
          </div>

          {/* הכנסות */}
          <div className="rounded-xl border border-black/10 bg-white/90 px-3 py-2">
            <div className="text-xs text-muted">הכנסות (קבלות)</div>
            <div className="text-lg font-semibold">₪{totalIncome.toLocaleString("he-IL")}</div>
          </div>

          {/* הוצאות */}
          <div className="rounded-xl border border-black/10 bg-white/90 px-3 py-2">
            <div className="text-xs text-muted">הוצאות</div>
            <div className="text-lg font-semibold">₪{totalExpenses.toLocaleString("he-IL")}</div>
          </div>

          {/* רווח נקי */}
          <div className={`rounded-xl border px-3 py-2 ${netProfit >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            <div className={`text-xs ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>רווח נקי</div>
            <div className={`text-lg font-semibold ${netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {netProfit < 0 ? "-" : ""}₪{Math.abs(netProfit).toLocaleString("he-IL")}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
            className={`app-btn !px-3 !py-1.5 text-xs ${
              viewMode === "CLINIC" ? "app-btn-primary" : "app-btn-secondary"
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
      </section>

      {/* Charts */}
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

      {/* Unpaid Sessions — חובות פתוחים */}
      <section className="app-section">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            חובות פתוחים
            {filteredUnpaid.length > 0 && (
              <span className="mr-2 text-xs font-normal text-muted">
                {filteredUnpaid.length} פגישות · ₪{totalOutstanding.toLocaleString("he-IL")}
              </span>
            )}
          </h2>
        </div>
        {filteredUnpaid.length === 0 ? (
          <div className="rounded-lg bg-black/[0.02] px-3 py-4 text-center text-sm text-muted">
            אין חובות פתוחים בתקופה זו 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-right text-xs text-muted">
                  <th className="p-2 font-medium">תאריך</th>
                  <th className="p-2 font-medium">מטופל</th>
                  <th className="p-2 font-medium">מחיר</th>
                  <th className="p-2 font-medium">שולם</th>
                  <th className="p-2 font-medium text-rose-600">יתרה</th>
                  <th className="p-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUnpaid.map((row) => (
                  <tr key={row.sessionId} className="border-b border-black/5 hover:bg-black/[0.015]">
                    <td className="p-2 tabular-nums">{fmtDateShort(row.scheduledAt)}</td>
                    <td className="max-w-36 truncate p-2">
                      <Link href={`/patients/${row.patientId}`} className="text-accent hover:underline">
                        {row.patientName}
                      </Link>
                    </td>
                    <td className="p-2 tabular-nums">₪{row.feeNis}</td>
                    <td className="p-2 tabular-nums text-muted">
                      {row.paidNis > 0 ? `₪${row.paidNis}` : "—"}
                    </td>
                    <td className="p-2 tabular-nums font-semibold text-rose-600">₪{row.outstandingNis}</td>
                    <td className="p-2">
                      <Link
                        href={`/receipts/new?patientId=${row.patientId}`}
                        className="rounded-md border border-accent/25 bg-accent-soft px-2 py-0.5 text-xs text-accent hover:bg-accent/10"
                      >
                        הפק קבלה
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/10 bg-black/[0.02]">
                  <td colSpan={4} className="p-2 text-xs text-muted">סה״כ חובות</td>
                  <td className="p-2 tabular-nums font-semibold text-rose-600">₪{totalOutstanding.toLocaleString("he-IL")}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Receipts + Expenses */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="app-section">
          <h2 className="mb-2 text-sm font-semibold">קבלות שהופקו</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse text-sm">
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
                  <tr key={receipt.id} className="border-b border-black/5 hover:bg-black/[0.015]">
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
                    <td className="p-2 tabular-nums">₪{receipt.amountNis}</td>
                    <td className="p-2">
                      <Link href={`/receipts/${receipt.id}`} className="text-accent hover:underline">
                        {receipt.allocations} פגישות
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredReceipts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-sm text-muted">אין קבלות בתקופה זו</td>
                  </tr>
                )}
              </tbody>
              {filteredReceipts.length > 0 && (
                <tfoot>
                  <tr className="border-t border-black/10 bg-black/[0.02]">
                    <td colSpan={3} className="p-2 text-xs text-muted">סה״כ הכנסות</td>
                    <td className="p-2 tabular-nums font-semibold">₪{totalIncome.toLocaleString("he-IL")}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
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
            {filteredExpenses.length > 0 && (
              <div className="flex items-center justify-between border-t border-black/10 px-3 pt-2 text-xs text-muted">
                <span>סה״כ הוצאות</span>
                <span className="tabular-nums font-semibold">₪{totalExpenses.toLocaleString("he-IL")}</span>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
