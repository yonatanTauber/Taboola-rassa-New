"use client";

import Link from "next/link";
import { useRef, type TouchEvent } from "react";
import { useQuickActions } from "@/components/QuickActions";

export function QuickAddControl() {
  const {
    openMenu,
    menuAnimatingOut,
    toggleMenu,
    closeMenuWithAnimation,
    openAction,
  } = useQuickActions();
  const touchTriggeredAtRef = useRef(0);

  const menuVisible = openMenu || menuAnimatingOut;

  function handleToggleFromTouch(event: TouchEvent<HTMLButtonElement>) {
    event.preventDefault();
    touchTriggeredAtRef.current = Date.now();
    toggleMenu();
  }

  function handleToggleFromClick() {
    if (Date.now() - touchTriggeredAtRef.current < 550) return;
    toggleMenu();
  }

  return (
    <div data-quick-add-root="true" className="relative">
      {menuVisible ? (
        <>
          <div
            className="fixed inset-0 z-[88] bg-black/20 backdrop-blur-[1px] md:hidden"
            onClick={() => closeMenuWithAnimation()}
          >
            <div
              className="absolute inset-x-3 rounded-2xl border border-black/14 bg-white p-3 shadow-2xl"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.7rem)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 text-sm font-semibold text-ink">פעולות מהירות</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="app-btn app-btn-secondary w-full text-xs"
                  onClick={() => openAction("session")}
                >
                  פגישה חדשה
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-secondary w-full text-xs"
                  onClick={() => openAction("task")}
                >
                  משימה חדשה
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-secondary w-full text-xs"
                  onClick={() => openAction("note")}
                >
                  פתק חופשי
                </button>
                <Link
                  href="/patients/new"
                  onClick={() => closeMenuWithAnimation()}
                  className="app-btn app-btn-secondary w-full text-xs"
                >
                  מטופל חדש
                </Link>
                <Link
                  href="/inquiries"
                  onClick={() => closeMenuWithAnimation()}
                  className="app-btn app-btn-secondary w-full text-xs"
                >
                  פנייה חדשה
                </Link>
                <Link
                  href="/research"
                  onClick={() => closeMenuWithAnimation()}
                  className="app-btn app-btn-secondary w-full text-xs"
                >
                  מאמר
                </Link>
                <Link
                  href="/receipts/new"
                  onClick={() => closeMenuWithAnimation()}
                  className="app-btn app-btn-secondary col-span-2 w-full text-xs"
                >
                  קבלה
                </Link>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute right-0 top-12 z-50 hidden w-[min(84vw,20rem)] flex-col items-end gap-2 md:flex md:left-1/2 md:right-auto md:w-auto md:-translate-x-1/2 md:items-center">
            <BubbleMenuAction index={0} label="משימה חדשה" visible={!menuAnimatingOut} onClick={() => openAction("task")} />
            <BubbleMenuAction index={1} label="פגישה חדשה" visible={!menuAnimatingOut} onClick={() => openAction("session")} />
            <BubbleMenuLink index={2} label="מטופל חדש" visible={!menuAnimatingOut} href="/patients/new" onClick={closeMenuWithAnimation} />
            <BubbleMenuLink index={3} label="פנייה חדשה" visible={!menuAnimatingOut} href="/inquiries" onClick={closeMenuWithAnimation} />
            <BubbleMenuAction index={4} label="פתק חופשי" visible={!menuAnimatingOut} onClick={() => openAction("note")} />
            <BubbleMenuLink index={5} label="מאמר" visible={!menuAnimatingOut} href="/research" onClick={closeMenuWithAnimation} />
            <BubbleMenuLink index={6} label="קבלה" visible={!menuAnimatingOut} href="/receipts/new" onClick={closeMenuWithAnimation} />
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={handleToggleFromClick}
        onTouchEnd={handleToggleFromTouch}
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
