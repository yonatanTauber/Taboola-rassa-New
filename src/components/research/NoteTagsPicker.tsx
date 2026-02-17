"use client";

import { useState, useCallback } from "react";
import { EntityBadge } from "@/components/EntityBadge";
import type { EntityType } from "@/lib/entity-config";

export type LinkableEntity = {
  entityType: string;
  entityId: string;
  label: string;
};

type CategoryOption = { id: string; label: string };

export type LinkableCategories = {
  patients: CategoryOption[];
  topics: CategoryOption[];
  documents: CategoryOption[];
};

const CATEGORY_CONFIG: Array<{
  key: keyof LinkableCategories;
  entityType: string;
  badgeType: EntityType;
  label: string;
}> = [
  { key: "patients", entityType: "patient", badgeType: "patient", label: "מטופל" },
  { key: "topics", entityType: "topic", badgeType: "research-note", label: "נושא" },
  { key: "documents", entityType: "research-document", badgeType: "research-document", label: "מאמר" },
];

export function NoteTagsPicker({
  categories,
  value,
  onChange,
}: {
  categories: LinkableCategories;
  value: LinkableEntity[];
  onChange: (tags: LinkableEntity[]) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_CONFIG[0].key);
  const [selectedEntityId, setSelectedEntityId] = useState("");

  const handleAdd = useCallback(() => {
    if (!selectedEntityId) return;
    const catConfig = CATEGORY_CONFIG.find((c) => c.key === selectedCategory);
    if (!catConfig) return;
    const options = categories[selectedCategory];
    const option = options.find((o) => o.id === selectedEntityId);
    if (!option) return;
    // Avoid duplicates
    if (value.some((t) => t.entityType === catConfig.entityType && t.entityId === option.id)) return;
    onChange([...value, { entityType: catConfig.entityType, entityId: option.id, label: option.label }]);
    setSelectedEntityId("");
  }, [selectedCategory, selectedEntityId, categories, value, onChange]);

  const handleRemove = useCallback(
    (entityType: string, entityId: string) => {
      onChange(value.filter((t) => !(t.entityType === entityType && t.entityId === entityId)));
    },
    [value, onChange],
  );

  const currentOptions = categories[selectedCategory] ?? [];

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted">קישורים (tags)</span>

      {/* Existing tags as chips */}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => {
            const catConfig = CATEGORY_CONFIG.find((c) => c.entityType === tag.entityType);
            return (
              <span
                key={`${tag.entityType}:${tag.entityId}`}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-0.5 text-xs"
              >
                <EntityBadge type={catConfig?.badgeType ?? "research-note"} showLabel={false} compact />
                <span className="max-w-[140px] truncate">{tag.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(tag.entityType, tag.entityId)}
                  className="mr-0.5 text-muted transition hover:text-rose-500"
                  aria-label={`הסר ${tag.label}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Add row */}
      <div className="flex items-center gap-1.5">
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value as keyof LinkableCategories);
            setSelectedEntityId("");
          }}
          className="app-field !w-auto !min-w-0 !py-1 text-xs"
        >
          {CATEGORY_CONFIG.map((cat) => (
            <option key={cat.key} value={cat.key}>
              {cat.label}
            </option>
          ))}
        </select>

        <select
          value={selectedEntityId}
          onChange={(e) => setSelectedEntityId(e.target.value)}
          className="app-field !min-w-0 flex-1 !py-1 text-xs"
        >
          <option value="">בחר…</option>
          {currentOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedEntityId}
          className="app-btn app-btn-secondary !px-2 !py-1 text-xs disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
