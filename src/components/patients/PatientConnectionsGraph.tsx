"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ConnectionGraphNode, PatientConnectionsGraphData } from "@/lib/patient-connections";

type ThemeMode = "dark" | "light";

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 560;
const CENTER_X = VIEWBOX_WIDTH / 2;
const CENTER_Y = VIEWBOX_HEIGHT / 2;
const INITIAL_RELATED_COUNT = 24;
const LOAD_MORE_STEP = 12;
const THEME_STORAGE_KEY = "patient-graph-theme";
const DEFAULT_ZOOM_BY_VARIANT = { embedded: 1.08, full: 1 } as const;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.1;
const LABEL_SAFE_X = 90;
const LABEL_SAFE_TOP = 56;
const LABEL_SAFE_BOTTOM = 108;
const FILTERS_STORAGE_KEY = "patient-graph-filters";

type FilterKey = Exclude<ConnectionGraphNode["kind"], "patient">;
type GraphFilters = Record<FilterKey, boolean>;

const DEFAULT_FILTERS: GraphFilters = {
  session: true,
  task: true,
  guidance: true,
  "research-note": true,
  "research-document": true,
  receipt: true,
  "external-link": true,
};

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: "session", label: "פגישות" },
  { key: "guidance", label: "הדרכות" },
  { key: "task", label: "משימות" },
  { key: "research-document", label: "מאמרים" },
  { key: "research-note", label: "פתקים" },
  { key: "receipt", label: "קבלות" },
  { key: "external-link", label: "קישורים חיצוניים" },
];

export function PatientConnectionsGraph({
  data,
  openGraphHref,
  variant = "embedded",
}: {
  data: PatientConnectionsGraphData;
  openGraphHref?: string;
  variant?: "embedded" | "full";
}) {
  const [visibleRelatedCount, setVisibleRelatedCount] = useState(INITIAL_RELATED_COUNT);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const zoomStorageKey = `patient-graph-zoom-${variant}`;
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" ? "dark" : "light";
  });
  const [zoom, setZoom] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_ZOOM_BY_VARIANT[variant];
    const saved = Number(window.localStorage.getItem(zoomStorageKey));
    if (Number.isFinite(saved) && saved >= MIN_ZOOM && saved <= MAX_ZOOM) return saved;
    return DEFAULT_ZOOM_BY_VARIANT[variant];
  });
  const [filters, setFilters] = useState<GraphFilters>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    const saved = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!saved) return DEFAULT_FILTERS;
    try {
      const parsed = JSON.parse(saved) as Partial<GraphFilters>;
      return { ...DEFAULT_FILTERS, ...parsed };
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem(zoomStorageKey, String(zoom));
  }, [zoom, zoomStorageKey]);
  useEffect(() => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const centerNode = useMemo(
    () => data.nodes.find((node) => node.id === data.patientNodeId) ?? null,
    [data.nodes, data.patientNodeId],
  );

  const relatedNodes = useMemo(
    () =>
      data.nodes
        .filter((node) => node.id !== data.patientNodeId)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          if ((a.sortValue ?? 0) !== (b.sortValue ?? 0)) return (b.sortValue ?? 0) - (a.sortValue ?? 0);
          return a.label.localeCompare(b.label, "he");
        }),
    [data.nodes, data.patientNodeId],
  );

  const filteredRelatedNodes = useMemo(
    () => relatedNodes.filter((node) => filters[node.kind as FilterKey] ?? true),
    [relatedNodes, filters],
  );

  const visibleRelatedNodes = filteredRelatedNodes.slice(0, visibleRelatedCount);
  const hasMoreNodes = filteredRelatedNodes.length > visibleRelatedNodes.length;

  const visibleNodes = useMemo(() => {
    if (!centerNode) return visibleRelatedNodes;
    return [centerNode, ...visibleRelatedNodes];
  }, [centerNode, visibleRelatedNodes]);

  const positionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (centerNode) {
      map.set(centerNode.id, { x: CENTER_X, y: CENTER_Y });
    }

    const count = Math.max(visibleRelatedNodes.length, 1);
    visibleRelatedNodes.forEach((node, index) => {
      const baseAngle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const angleJitter = ((hashToUnit(node.id + "-a") - 0.5) * Math.PI) / 10;
      const ring = index % 3;
      const baseRadius = 165 + ring * 70;
      const radiusJitter = (hashToUnit(node.id + "-r") - 0.5) * 28;
      const radius = baseRadius + radiusJitter;
      const angle = baseAngle + angleJitter;
      const x = clamp(CENTER_X + Math.cos(angle) * radius, LABEL_SAFE_X, VIEWBOX_WIDTH - LABEL_SAFE_X);
      const y = clamp(CENTER_Y + Math.sin(angle) * radius, LABEL_SAFE_TOP, VIEWBOX_HEIGHT - LABEL_SAFE_BOTTOM);
      map.set(node.id, { x, y });
    });

    return map;
  }, [centerNode, visibleRelatedNodes]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () => data.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [data.edges, visibleNodeIds],
  );
  const activeFiltersCount = FILTER_OPTIONS.filter((option) => filters[option.key]).length;
  const graphTransform = `translate(${CENTER_X} ${CENTER_Y}) scale(${zoom}) translate(${-CENTER_X} ${-CENTER_Y})`;

  if (!centerNode) {
    return <div className="rounded-xl bg-black/[0.03] px-3 py-2 text-sm text-muted">אין נתוני קשרים להצגה.</div>;
  }

  const palette = theme === "dark" ? DARK_THEME : LIGHT_THEME;
  const themeToggleButtonClass =
    theme === "dark"
      ? "app-btn !border-white/28 !bg-[#eff4fb] !text-[#1f2e3b] hover:!bg-white !px-3 !py-1 text-xs"
      : "app-btn app-btn-secondary !px-3 !py-1 text-xs";

  return (
    <section className={`patient-graph-shell rounded-2xl border p-3 ${palette.shell}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">רשת קישורים סינפטית</h3>
          <p className="text-xs text-muted">גרף קשרים מהיר לניווט בין ישויות הקשורות למטופל</p>
        </div>
        <div className="flex items-center gap-2">
          {openGraphHref ? (
            <Link href={openGraphHref} className="app-btn app-btn-secondary !px-3 !py-1 text-xs">
              פתח בדף נפרד
            </Link>
          ) : null}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((prev) => clamp(prev - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
              className="app-btn app-btn-secondary !min-w-[2.2rem] !px-2 !py-1 text-xs"
              aria-label="הקטנת הגרף"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setZoom(DEFAULT_ZOOM_BY_VARIANT[variant])}
              className="app-btn app-btn-secondary !px-2.5 !py-1 text-[11px]"
              aria-label="איפוס זום"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((prev) => clamp(prev + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
              className="app-btn app-btn-secondary !min-w-[2.2rem] !px-2 !py-1 text-xs"
              aria-label="הגדלת הגרף"
            >
              +
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="app-btn app-btn-secondary !px-3 !py-1 text-xs"
              aria-expanded={filtersOpen}
              aria-label="פתיחה וסגירה של פילטרים"
            >
              פילטרים ({activeFiltersCount})
            </button>
            {filtersOpen ? (
              <div
                className={`absolute right-0 top-10 z-20 w-64 max-w-[calc(100vw-2rem)] rounded-xl border p-2.5 shadow-xl ${theme === "dark" ? "border-white/24 bg-[#2a313a] text-[#eef3f8]" : "border-black/12 bg-white text-ink"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold">מה להציג</div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                      className="text-accent hover:underline"
                    >
                      הכל
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFilters({
                          session: false,
                          task: false,
                          guidance: false,
                          "research-note": false,
                          "research-document": false,
                          receipt: false,
                          "external-link": false,
                        })
                      }
                      className="text-muted hover:underline"
                    >
                      נקה
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {FILTER_OPTIONS.map((option) => (
                    <label key={option.key} className="flex items-center justify-between gap-3 text-sm">
                      <span>{option.label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={filters[option.key]}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            [option.key]: !prev[option.key],
                          }))
                        }
                        className="filter-switch"
                        data-on={filters[option.key] ? "true" : "false"}
                      >
                        <span className="filter-switch-thumb" />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className={themeToggleButtonClass}
            aria-label="החלפת תצוגת גרף"
          >
            {theme === "dark" ? "תצוגה בהירה" : "תצוגה כהה"}
          </button>
          {hasMoreNodes ? (
              <button
                type="button"
                onClick={() =>
                  setVisibleRelatedCount((prev) => prev + LOAD_MORE_STEP)
                }
                className="app-btn app-btn-primary !px-3 !py-1 text-xs"
              >
                הצג עוד
              </button>
          ) : null}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className={
          variant === "full"
            ? "h-[76vh] min-h-[620px] w-full rounded-xl"
            : "h-[56vh] min-h-[430px] w-full rounded-xl"
        }
        role="img"
        aria-label="גרף קשרים של המטופל"
      >
        <defs>
          <radialGradient id="graphBackdrop" cx="50%" cy="50%" r="72%">
            <stop offset="0%" stopColor={palette.backdropInner} />
            <stop offset="100%" stopColor={palette.backdropOuter} />
          </radialGradient>
        </defs>
        {theme === "dark" ? (
          <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} rx={16} fill="url(#graphBackdrop)" />
        ) : null}
        <g transform={graphTransform}>
          {visibleEdges.map((edge) => {
            const source = positionMap.get(edge.source);
            const target = positionMap.get(edge.target);
            if (!source || !target) return null;
            const active = hoveredNodeId ? edge.source === hoveredNodeId || edge.target === hoveredNodeId : false;
            const d = edgePath(source.x, source.y, target.x, target.y, hashToUnit(edge.id));
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke={edge.relation === "secondary" ? palette.edgeSecondary : palette.edgePrimary}
                strokeOpacity={active ? 0.88 : 0.28}
                strokeWidth={active ? (edge.relation === "secondary" ? 1.8 : 1.5) : edge.relation === "secondary" ? 1.2 : 1}
                className="patient-graph-edge"
              />
            );
          })}

          {visibleNodes.map((node) => {
            const pos = positionMap.get(node.id);
            if (!pos) return null;
            const style = nodeStyle(node.kind, theme);
            const isCenter = node.id === data.patientNodeId;
            const r = isCenter ? 18 : 8;
            const label = truncateLabel(node.label, isCenter ? 26 : 18);
            const labelX = pos.x;
            const labelY = pos.y + r + 16;
            const textAnchor = "middle";

            const content = (
              <g className="patient-graph-node">
                <title>{node.label}</title>
                <circle cx={pos.x} cy={pos.y} r={r} fill={style.fill} stroke={style.stroke} strokeWidth={isCenter ? 3 : 2} />
                <text
                  x={labelX}
                  y={labelY}
                  fill={style.text}
                  fontSize={isCenter ? 19 : 14}
                  fontWeight={isCenter ? 700 : 500}
                  textAnchor={textAnchor}
                  className="patient-graph-node-label"
                >
                  {label}
                </text>
                {node.meta ? (
                  <text
                    x={labelX}
                    y={labelY + 14}
                    fill={palette.metaText}
                    fontSize={11}
                    textAnchor={textAnchor}
                    className="patient-graph-node-meta"
                  >
                    {truncateLabel(node.meta, 24)}
                  </text>
                ) : null}
              </g>
            );

            return (
              <a
                key={node.id}
                href={node.href}
                target={node.external ? "_blank" : undefined}
                rel={node.external ? "noreferrer" : undefined}
                aria-label={`פתח ${node.label}`}
                className="patient-graph-link"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId((prev) => (prev === node.id ? null : prev))}
                onFocus={() => setHoveredNodeId(node.id)}
                onBlur={() => setHoveredNodeId((prev) => (prev === node.id ? null : prev))}
              >
                {content}
              </a>
            );
          })}
        </g>
      </svg>

      <div className="mt-2 text-xs text-muted">
        מוצגים {visibleRelatedNodes.length} מתוך {filteredRelatedNodes.length} קשרים פעילים.
      </div>
    </section>
  );
}

function nodeStyle(kind: ConnectionGraphNode["kind"], theme: ThemeMode) {
  const palette = theme === "dark" ? DARK_NODE_STYLE : LIGHT_NODE_STYLE;
  return palette[kind] ?? palette["external-link"];
}

function truncateLabel(value: string, maxLen: number) {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(1, maxLen - 1))}…`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashToUnit(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function edgePath(x1: number, y1: number, x2: number, y2: number, seed: number) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const nx = -dy / dist;
  const ny = dx / dist;
  const bend = (seed - 0.5) * 20;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

const DARK_THEME = {
  shell: "border-white/16 bg-[#2b3440]",
  backdropInner: "#44505e",
  backdropOuter: "#313b48",
  edgePrimary: "#d6dee8",
  edgeSecondary: "#a5c1d8",
  metaText: "#c3cdd8",
};

const LIGHT_THEME = {
  shell: "border-black/10 bg-transparent",
  backdropInner: "transparent",
  backdropOuter: "transparent",
  edgePrimary: "#5b6a7a",
  edgeSecondary: "#365a7b",
  metaText: "#4b5563",
};

const DARK_NODE_STYLE: Record<ConnectionGraphNode["kind"], { fill: string; stroke: string; text: string }> = {
  patient: { fill: "#dce8e1", stroke: "#6ab596", text: "#f1f8f4" },
  session: { fill: "#c6d4e5", stroke: "#78a4d6", text: "#dce8f6" },
  task: { fill: "#f0ddaf", stroke: "#d1aa53", text: "#f6e9c7" },
  guidance: { fill: "#cdd9e8", stroke: "#7d9ec2", text: "#deebfa" },
  "research-note": { fill: "#e5d8f2", stroke: "#b490df", text: "#f2e9ff" },
  "research-document": { fill: "#d9d2ec", stroke: "#a687d1", text: "#eee8f8" },
  receipt: { fill: "#eddcc6", stroke: "#d0a66f", text: "#f8e9d6" },
  "external-link": { fill: "#d7dde3", stroke: "#9ea8b2", text: "#e7edf2" },
};

const LIGHT_NODE_STYLE: Record<ConnectionGraphNode["kind"], { fill: string; stroke: string; text: string }> = {
  patient: { fill: "#cee5d8", stroke: "#2f6d5a", text: "#1f3d34" },
  session: { fill: "#d2ddec", stroke: "#3b6a99", text: "#243f5c" },
  task: { fill: "#fde8be", stroke: "#b8822a", text: "#69490f" },
  guidance: { fill: "#d6e0ec", stroke: "#365a7b", text: "#1f3f5a" },
  "research-note": { fill: "#e5daf3", stroke: "#7a4d99", text: "#512d67" },
  "research-document": { fill: "#dfd2e8", stroke: "#7a4d99", text: "#512d67" },
  receipt: { fill: "#efdfc4", stroke: "#8a6324", text: "#5f4317" },
  "external-link": { fill: "#ececec", stroke: "#6b7280", text: "#374151" },
};
