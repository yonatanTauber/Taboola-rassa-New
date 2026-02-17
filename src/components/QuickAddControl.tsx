"use client";

import Link from "next/link";
import { useQuickActions } from "@/components/QuickActions";

export function QuickAddControl() {
  const {
    openMenu,
    menuAnimatingOut,
    toggleMenu,
    closeMenuWithAnimation,
    openAction,
  } = useQuickActions();

  const menuVisible = openMenu || menuAnimatingOut;

  return (
    <div data-quick-add-root="true" className="relative">
      {menuVisible ? (
        <div className="pointer-events-none absolute right-0 top-12 z-50 flex w-[min(84vw,20rem)] flex-col items-end gap-2 md:left-1/2 md:right-auto md:w-auto md:-translate-x-1/2 md:items-center">
          <BubbleMenuAction index={0} label="משימה חדשה" visible={!menuAnimatingOut} onClick={() => openAction("task")} />
          <BubbleMenuAction index={1} label="פגישה חדש" visible={!menuAnimatingOut} onClick={() => openAction("session")} />
          <BubbleMenuLink index={2} label="מטופל חדש" visible={!menuAnimatingOut} href="/patients/new" onClick={closeMenuWithAnimation} />
          <BubbleMenuLink index={3} label="פנייה חדשה" visible={!menuAnimatingOut} href="/inquiries" onClick={closeMenuWithAnimation} />
          <BubbleMenuAction index={4} label="פתק חופשי" visible={!menuAnimatingOut} onClick={() => openAction("note")} />
          <BubbleMenuLink index={5} label="מאמר" visible={!menuAnimatingOut} href="/research" onClick={closeMenuWithAnimation} />
          <BubbleMenuLink index={6} label="קבלה" visible={!menuAnimatingOut} href="/receipts/new" onClick={closeMenuWithAnimation} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={toggleMenu}
        className="size-10 rounded-full border border-accent/25 bg-accent text-[1.5rem] leading-none text-white shadow-[0_10px_22px_rgba(35,85,168,0.30)] transition hover:brightness-95"
        aria-label="פתיחת תפריט הוספה"
      >
        +
      </button>
    </div>
  );
}

function BubbleMenuAction({
  onClick,
  label,
  visible,
  index,
}: {
  onClick: () => void;
  label: string;
  visible: boolean;
  index: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{ transitionDelay: `${index * 28}ms` }}
      className={`pointer-events-auto w-full rounded-full border border-black/10 bg-white px-4 py-2 text-center text-sm text-ink shadow-md transition-all duration-200 md:w-48 hover:bg-accent-soft ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {label}
    </button>
  );
}

function BubbleMenuLink({
  href,
  label,
  onClick,
  visible,
  index,
}: {
  href: string;
  label: string;
  onClick: () => void;
  visible: boolean;
  index: number;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{ transitionDelay: `${index * 28}ms` }}
      className={`pointer-events-auto w-full rounded-full border border-black/10 bg-white px-4 py-2 text-center text-sm text-ink shadow-md transition-all duration-200 md:w-48 hover:bg-accent-soft ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {label}
    </Link>
  );
}
