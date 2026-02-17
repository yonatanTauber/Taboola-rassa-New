import { ENTITY_CONFIG, type EntityType } from "@/lib/entity-config";

export function EntityBadge({
  type,
  showLabel = true,
  compact = false,
}: {
  type: EntityType;
  showLabel?: boolean;
  compact?: boolean;
}) {
  const config = ENTITY_CONFIG[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${config.badgeBg} ${config.badgeText} ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span className={compact ? "text-[9px]" : "text-[11px]"}>{config.icon}</span>
      {showLabel ? <span>{compact ? config.labelShort : config.label}</span> : null}
    </span>
  );
}
