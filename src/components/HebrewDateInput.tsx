"use client";

const months = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export function HebrewDateInput({
  value,
  onChange,
  namePrefix,
  ariaLabelPrefix,
}: {
  value: string;
  onChange: (next: string) => void;
  namePrefix?: string;
  ariaLabelPrefix?: string;
}) {
  const now = new Date();
  const [y, m, d] = value.split("-").map(Number);
  const year = Number.isFinite(y) ? y : now.getFullYear();
  const month = Number.isFinite(m) ? m : now.getMonth() + 1;
  const day = Number.isFinite(d) ? d : now.getDate();

  const years = Array.from({ length: 90 }).map((_, idx) => now.getFullYear() + 5 - idx);
  const daysInMonth = new Date(year, month, 0).getDate();

  const setDate = (nextYear: number, nextMonth: number, nextDay: number) => {
    const safeDay = Math.min(nextDay, new Date(nextYear, nextMonth, 0).getDate());
    const next = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        name={namePrefix ? `${namePrefix}-day` : undefined}
        aria-label={ariaLabelPrefix ? `${ariaLabelPrefix} יום` : undefined}
        autoComplete="off"
        value={day}
        onChange={(e) => setDate(year, month, Number(e.target.value))}
        className="app-select"
      >
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const n = idx + 1;
          return (
            <option key={n} value={n}>
              {n}
            </option>
          );
        })}
      </select>
      <select
        name={namePrefix ? `${namePrefix}-month` : undefined}
        aria-label={ariaLabelPrefix ? `${ariaLabelPrefix} חודש` : undefined}
        autoComplete="off"
        value={month}
        onChange={(e) => setDate(year, Number(e.target.value), day)}
        className="app-select"
      >
        {months.map((label, idx) => (
          <option key={label} value={idx + 1}>
            {label}
          </option>
        ))}
      </select>
      <select
        name={namePrefix ? `${namePrefix}-year` : undefined}
        aria-label={ariaLabelPrefix ? `${ariaLabelPrefix} שנה` : undefined}
        autoComplete="off"
        value={year}
        onChange={(e) => setDate(Number(e.target.value), month, day)}
        className="app-select"
      >
        {years.map((yopt) => (
          <option key={yopt} value={yopt}>
            {yopt}
          </option>
        ))}
      </select>
    </div>
  );
}
