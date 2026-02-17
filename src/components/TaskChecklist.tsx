"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuickActions } from "@/components/QuickActions";

type TaskRow = {
  id: string;
  title: string;
  patientName?: string;
  dueLabel?: string;
  href: string;
};

export function TaskChecklist({ tasks, compact = false }: { tasks: TaskRow[]; compact?: boolean }) {
  const router = useRouter();
  const { showToast } = useQuickActions();
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});

  async function toggleDone(task: TaskRow, nextDone: boolean, anchor?: { x: number; y: number }) {
    setDoneMap((prev) => ({ ...prev, [task.id]: nextDone }));
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextDone ? "DONE" : "OPEN" }),
    });
    if (!res.ok) {
      setDoneMap((prev) => ({ ...prev, [task.id]: !nextDone }));
      return;
    }

    showToast({ message: nextDone ? "המשימה סומנה כבוצעה" : "המשימה חזרה לפתוחה", durationMs: 2400, anchor });
    router.refresh();
  }

  return (
    <ul className={compact ? "space-y-1 text-xs" : "space-y-2 text-sm"}>
      {tasks.map((task) => {
        const done = doneMap[task.id];
        return (
          <li key={task.id} className={`rounded-lg border border-black/10 px-2 py-1.5 ${done ? "bg-black/[0.02]" : "bg-white"}`}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(done)}
                onChange={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  toggleDone(task, e.target.checked, { x: rect.left + rect.width / 2, y: rect.top });
                }}
                className="size-4 accent-accent"
              />
              <Link
                href={task.href}
                className={`grow rounded px-1 py-0.5 transition hover:bg-accent-soft ${done ? "text-muted line-through" : "text-ink"}`}
              >
                {task.title}
                {task.patientName ? ` (${task.patientName})` : ""}
                {task.dueLabel ? ` · ${task.dueLabel}` : ""}
              </Link>
              {done ? <span className="text-xs text-accent">✓</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
