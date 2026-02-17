"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const items = [
  { href: "/patients", label: "מטופל חדש" },
  { href: "/sessions", label: "פגישה" },
  { href: "/sessions", label: "משימה" },
  { href: "/settings", label: "קבלה" },
  { href: "/research", label: "פתק חופשי" },
  { href: "/research", label: "נושא חדש" },
  { href: "/research", label: "מאמר" },
];

export function FloatingAddMenu() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef({ active: false, moved: false, offsetX: 0, offsetY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!open) return;
      const target = e.target as Node;
      if (!containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="fixed z-50"
      style={
        position
          ? { left: position.x, top: position.y }
          : { left: "50%", bottom: 24, transform: "translateX(-50%)" }
      }
    >
      {open ? (
        <div className="mb-3 min-w-44 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
          {items.map((item) => (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-accent-soft"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onPointerDown={(e) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          drag.current.active = true;
          drag.current.moved = false;
          drag.current.offsetX = e.clientX - rect.left;
          drag.current.offsetY = e.clientY - rect.top;

          const onMove = (moveEvent: PointerEvent) => {
            if (!drag.current.active) return;
            drag.current.moved = true;
            setPosition({
              x: moveEvent.clientX - drag.current.offsetX,
              y: moveEvent.clientY - drag.current.offsetY,
            });
          };
          const onUp = () => {
            drag.current.active = false;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
        onClick={() => {
          if (drag.current.moved) return;
          setOpen((prev) => !prev);
        }}
        className="size-14 rounded-full border border-accent/25 bg-accent text-3xl leading-none text-white shadow-[0_12px_30px_rgba(45,91,255,0.35)] transition hover:brightness-95"
        aria-label="פתיחת תפריט הוספה"
      >
        +
      </button>
    </div>
  );
}
