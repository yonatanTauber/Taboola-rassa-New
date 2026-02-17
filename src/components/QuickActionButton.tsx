"use client";

import { useQuickActions } from "@/components/QuickActions";

export function QuickActionButton({
  action,
  label,
  className,
}: {
  action: "task" | "session" | "note";
  label: string;
  className?: string;
}) {
  const { openAction } = useQuickActions();

  return (
    <button type="button" onClick={() => openAction(action)} className={className}>
      {label}
    </button>
  );
}
