"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { AnalogClock } from "@/components/AnalogClock";
import { AppLogo } from "@/components/AppLogo";
import { QuickAddControl } from "@/components/QuickAddControl";
import { useQuickActions } from "@/components/QuickActions";

const PRIMARY_ITEMS = [
  { href: "/", label: "דשבורד" },
  { href: "/patients", label: "מטופלים" },
  { href: "/sessions", label: "פגישות" },
  { href: "/tasks", label: "משימות" },
];

const SECONDARY_ITEMS = [
  { href: "/guidance", label: "הדרכות" },
  { href: "/inquiries", label: "פניות" },
  { href: "/receipts", label: "כספים" },
  { href: "/research", label: "מחקר" },
  { href: "/settings", label: "הגדרות" },
];

export function TopNav({ canManageInvites = false }: { canManageInvites?: boolean }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openAction } = useQuickActions();
  const items = useMemo(() => {
    if (!canManageInvites) return [...PRIMARY_ITEMS, ...SECONDARY_ITEMS];
    return [...PRIMARY_ITEMS, ...SECONDARY_ITEMS.slice(0, -1), { href: "/invites", label: "הזמנות" }, SECONDARY_ITEMS[SECONDARY_ITEMS.length - 1]];
  }, [canManageInvites]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="surface-card rounded-2xl border border-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="app-btn app-btn-secondary !px-3 text-sm"
          aria-label="פתיחת תפריט"
        >
          תפריט
        </button>
        <Link href="/" className="rounded-xl p-1 transition hover:bg-black/[0.04]" aria-label="חזרה לדף היומי">
          <AppLogo compact />
        </Link>
        <QuickAddControl />
      </div>

      <div className="hidden items-center justify-between gap-3 md:flex">
        <Link href="/" className="rounded-xl p-1 transition hover:bg-black/[0.04]" aria-label="חזרה לדף היומי">
          <AppLogo compact />
        </Link>

        <nav className="hidden flex-1 flex-wrap items-center justify-center gap-3 lg:flex-nowrap md:flex">
          {PRIMARY_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-accent/40 bg-accent-soft text-accent"
                    : "border-black/14 bg-white/90 text-ink hover:bg-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <QuickAddControl />

          {items.slice(PRIMARY_ITEMS.length).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-accent/40 bg-accent-soft text-accent"
                    : "border-black/14 bg-white/90 text-ink hover:bg-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-black/14 bg-white/90 px-3 py-1.5 text-sm text-ink transition hover:bg-white"
          >
            יציאה
          </button>
          <AnalogClock compact />
        </div>
      </div>

      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-[80] bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="absolute inset-x-3 top-3 rounded-2xl border border-black/16 bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">תפריט</div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="app-btn app-btn-secondary text-xs">
                סגור
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-xl border px-3 py-2 text-sm text-center ${
                      active ? "border-accent/40 bg-accent-soft text-accent" : "border-black/12 bg-white text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="app-btn app-btn-secondary w-full text-xs"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAction("session");
                }}
              >
                פגישה חדש
              </button>
              <button
                type="button"
                className="app-btn app-btn-secondary w-full text-xs"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAction("task");
                }}
              >
                משימה חדשה
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={handleLogout}
                className="app-btn app-btn-secondary text-xs"
              >
                יציאה
              </button>
              <AnalogClock compact />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
