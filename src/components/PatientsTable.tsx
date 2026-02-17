"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  gender: string;
  age: number | null;
  ageGroup: "CHILD" | "YOUTH" | "ADULT" | "SENIOR" | "UNKNOWN";
  defaultSessionFeeNis: number | null;
  lastSessionAt: string | null;
  nextSessionAt: string | null;
  openTasksCount: number;
  sessionsCount: number;
  archivedAt: string | null;
};

type ColumnKey = "name" | "phone" | "gender" | "age" | "lastSession" | "nextSession" | "tasks" | "sessions" | "archivedAt";
type SortDirection = "ASC" | "DESC";
type GenderFilterKey = "MALE" | "FEMALE" | "OTHER";
type AgeGroupFilterKey = Row["ageGroup"];

type FilterCheckboxItem =
  | { group: "gender"; key: GenderFilterKey; label: string }
  | { group: "ageGroup"; key: AgeGroupFilterKey; label: string };

const ACTIVE_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "name", label: "שם" },
  { key: "phone", label: "טלפון" },
  { key: "gender", label: "מגדר" },
  { key: "age", label: "גיל" },
  { key: "lastSession", label: "פגישה אחרונה" },
  { key: "nextSession", label: "פגישה הבאה" },
  { key: "tasks", label: "משימות פתוחות" },
  { key: "sessions", label: "מספר פגישות" },
];

const ARCHIVED_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  ...ACTIVE_COLUMNS,
  { key: "archivedAt", label: "תאריך ארכוב" },
];

const FILTER_CHECKBOX_ITEMS: FilterCheckboxItem[] = [
  { group: "gender", key: "MALE", label: "מגדר: גבר" },
  { group: "gender", key: "FEMALE", label: "מגדר: אישה" },
  { group: "gender", key: "OTHER", label: "מגדר: אחר" },
  { group: "ageGroup", key: "CHILD", label: "קבוצת גיל: ילדות/ילדים" },
  { group: "ageGroup", key: "YOUTH", label: "קבוצת גיל: נוער" },
  { group: "ageGroup", key: "ADULT", label: "קבוצת גיל: מבוגרים" },
  { group: "ageGroup", key: "SENIOR", label: "קבוצת גיל: גיל שלישי (75+)" },
  { group: "ageGroup", key: "UNKNOWN", label: "קבוצת גיל: ללא תאריך לידה" },
];

const DEFAULT_GENDER_FILTERS: Record<GenderFilterKey, boolean> = {
  MALE: true,
  FEMALE: true,
  OTHER: true,
};

const DEFAULT_AGE_GROUP_FILTERS: Record<AgeGroupFilterKey, boolean> = {
  CHILD: true,
  YOUTH: true,
  ADULT: true,
  SENIOR: true,
  UNKNOWN: true,
};

export function PatientsTable({ rows, archivedMode = false }: { rows: Row[]; archivedMode?: boolean }) {
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [genderFilters, setGenderFilters] = useState<Record<GenderFilterKey, boolean>>(DEFAULT_GENDER_FILTERS);
  const [ageGroupFilters, setAgeGroupFilters] = useState<Record<AgeGroupFilterKey, boolean>>(DEFAULT_AGE_GROUP_FILTERS);
  const [sortKey, setSortKey] = useState<ColumnKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ASC");
  const columns = archivedMode ? ARCHIVED_COLUMNS : ACTIVE_COLUMNS;

  const filtered = useMemo(() => {
    const searchText = q.trim().toLowerCase();

    const base = rows.filter((r) => {
      const genderKey = normalizeGender(r.gender);
      if (!genderFilters[genderKey]) return false;
      if (!ageGroupFilters[r.ageGroup]) return false;
      if (!searchText) return true;
      const text = `${r.firstName} ${r.lastName} ${r.phone} ${r.email}`.toLowerCase();
      return text.includes(searchText);
    });

    const sorted = [...base];
    sorted.sort((a, b) => {
      const result = compareRowsByKey(a, b, sortKey);
      return sortDirection === "ASC" ? result : -result;
    });
    return sorted;
  }, [rows, q, genderFilters, ageGroupFilters, sortKey, sortDirection]);

  const selectedFiltersCount =
    Object.values(genderFilters).filter(Boolean).length +
    Object.values(ageGroupFilters).filter(Boolean).length;
  const narrowedFiltersCount = FILTER_CHECKBOX_ITEMS.length - selectedFiltersCount;

  function clearFilters() {
    setGenderFilters({ ...DEFAULT_GENDER_FILTERS });
    setAgeGroupFilters({ ...DEFAULT_AGE_GROUP_FILTERS });
  }

  function clearAllFilterOptions() {
    setGenderFilters({ MALE: false, FEMALE: false, OTHER: false });
    setAgeGroupFilters({ CHILD: false, YOUTH: false, ADULT: false, SENIOR: false, UNKNOWN: false });
  }

  function toggleFilter(item: FilterCheckboxItem) {
    if (item.group === "gender") {
      setGenderFilters((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
      return;
    }
    setAgeGroupFilters((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
  }

  function handleSortByColumn(key: ColumnKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "ASC" ? "DESC" : "ASC"));
      return;
    }
    setSortKey(key);
    setSortDirection("ASC");
  }

  function sortIndicator(key: ColumnKey) {
    if (sortKey !== key) return "";
    return sortDirection === "ASC" ? "↑" : "↓";
  }

  function renderHeader(key: ColumnKey, label: string) {
    const indicator = sortIndicator(key);
    return (
      <th key={key} className="p-2 font-medium">
        <button
          type="button"
          onClick={() => handleSortByColumn(key)}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-black/[0.04]"
          aria-label={`מיון לפי ${label}`}
        >
          <span>{label}</span>
          <span className={`text-[10px] ${indicator ? "text-accent" : "text-transparent"}`}>{indicator || "↑"}</span>
        </button>
      </th>
    );
  }

  return (
    <section className="app-section">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש חופשי"
          className="app-field min-w-44 flex-1"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className="app-btn app-btn-secondary !px-3 !py-1 text-xs"
          aria-expanded={filtersOpen}
          aria-label="פתיחה וסגירה של פילטרים"
        >
          פילטרים {narrowedFiltersCount > 0 ? `(${narrowedFiltersCount})` : ""}
        </button>
        <button type="button" onClick={clearFilters} className="app-btn app-btn-primary !px-3 !py-1 text-xs">
          איפוס פילטרים
        </button>
      </div>

      {filtersOpen ? (
        <div className="mb-3 rounded-xl border border-black/12 bg-white/85 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-muted">רשימת סינון</div>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" onClick={clearFilters} className="text-accent hover:underline">
                בחר הכל
              </button>
              <button type="button" onClick={clearAllFilterOptions} className="text-muted hover:underline">
                נקה הכל
              </button>
            </div>
          </div>
          <ul className="space-y-1.5">
            {FILTER_CHECKBOX_ITEMS.map((item) => {
              const checked = item.group === "gender" ? genderFilters[item.key] : ageGroupFilters[item.key];
              return (
                <li key={`${item.group}-${item.key}`}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilter(item)}
                      className="h-4 w-4 rounded border-black/25 accent-[var(--accent)]"
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-right text-xs text-muted">
              {columns.map((column) => renderHeader(column.key, column.label))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-black/5 hover:bg-black/[0.02]">
                <td className="max-w-48 p-2">
                  {archivedMode ? (
                    <span className="inline-flex max-w-full items-center rounded-lg bg-black/[0.04] px-2.5 py-1 text-base font-semibold text-ink">
                      <span className="truncate">
                        {r.firstName} {r.lastName ? `${r.lastName.charAt(0)}.` : ""}
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={`/patients/${r.id}`}
                      className="inline-flex max-w-full items-center rounded-lg bg-accent-soft px-2.5 py-1 text-base font-semibold text-ink transition hover:bg-accent-soft/70"
                    >
                      <span className="truncate">
                        {r.firstName} {r.lastName ? `${r.lastName.charAt(0)}.` : ""}
                      </span>
                    </Link>
                  )}
                </td>
                <td className="max-w-36 p-2"><span className="block truncate">{r.phone}</span></td>
                <td className="whitespace-nowrap p-2">{genderLabel(r.gender)}</td>
                <td className="whitespace-nowrap p-2">{r.age ?? "—"}</td>
                <td className="whitespace-nowrap p-2">{formatDate(r.lastSessionAt)}</td>
                <td className="whitespace-nowrap p-2">{formatDate(r.nextSessionAt)}</td>
                <td className="whitespace-nowrap p-2">{r.openTasksCount}</td>
                <td className="p-2">{r.sessionsCount}</td>
                {archivedMode ? <td className="whitespace-nowrap p-2">{formatDate(r.archivedAt)}</td> : null}
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-4 text-center text-sm text-muted">
                  אין מטופלים שתואמים לפילטרים.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function genderLabel(g: string) {
  if (g === "MALE") return "גבר";
  if (g === "FEMALE") return "אישה";
  return "אחר";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL");
}

function compareRowsByKey(a: Row, b: Row, key: ColumnKey) {
  if (key === "name") return compareName(a, b);
  if (key === "phone") return compareText(a.phone, b.phone);
  if (key === "gender") return compareText(genderLabel(a.gender), genderLabel(b.gender));
  if (key === "age") return compareNullableNumber(a.age, b.age);
  if (key === "lastSession") return compareDateAsc(a.lastSessionAt, b.lastSessionAt);
  if (key === "nextSession") return compareDateAsc(a.nextSessionAt, b.nextSessionAt);
  if (key === "tasks") return compareNullableNumber(a.openTasksCount, b.openTasksCount);
  if (key === "sessions") return compareNullableNumber(a.sessionsCount, b.sessionsCount);
  if (key === "archivedAt") return compareDateAsc(a.archivedAt, b.archivedAt);
  return 0;
}

function compareName(a: Row, b: Row) {
  const fullA = `${a.firstName} ${a.lastName}`.trim();
  const fullB = `${b.firstName} ${b.lastName}`.trim();
  return fullA.localeCompare(fullB, "he", { sensitivity: "base" });
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "he", { numeric: true, sensitivity: "base" });
}

function compareDateAsc(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function compareNullableNumber(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function normalizeGender(value: string): GenderFilterKey {
  if (value === "MALE") return "MALE";
  if (value === "FEMALE") return "FEMALE";
  return "OTHER";
}
