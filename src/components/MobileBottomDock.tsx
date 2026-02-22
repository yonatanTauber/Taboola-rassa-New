"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

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

type DockPanel = "more" | null;

export function MobileBottomDock({ canManageInvites = false }: { canManageInvites?: boolean }) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<DockPanel>(null);

  const allSecondaryItems = useMemo(() => {
    if (!canManageInvites) return SECONDARY_ITEMS;
    return [...SECONDARY_ITEMS.slice(0, -1), { href: "/invites", label: "הזמנות" }, SECONDARY_ITEMS[SECONDARY_ITEMS.length - 1]];
  }, [canManageInvites]);

  return (
    <>
      {panel ? (
        <div className="fixed inset-0 z-[98] bg-black/20 backdrop-blur-[1px] md:hidden" onClick={() => setPanel(null)}>
          <div
            className="absolute inset-x-3 rounded-2xl border border-black/14 bg-white p-3 shadow-2xl"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 6.2rem)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 text-sm font-semibold text-ink">עוד אפשרויות</div>
            <div className="grid grid-cols-2 gap-2">
              {allSecondaryItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setPanel(null)}
                    className={`rounded-xl border px-3 py-2 text-center text-sm transition ${
                      active ? "border-accent/40 bg-accent-soft text-accent" : "border-black/12 bg-white text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-[97] md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}>
        <div className="mx-auto w-full max-w-[720px] px-2 pb-2">
          <nav className="grid grid-cols-5 gap-1 rounded-2xl border border-black/15 bg-white/96 p-1 shadow-lg backdrop-blur-sm" aria-label="ניווט מובייל">
            {PRIMARY_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl border px-2 py-2 text-center text-[12px] transition ${
                    active ? "border-accent/45 bg-accent-soft text-accent" : "border-black/12 bg-white text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setPanel((prev) => (prev === "more" ? null : "more"))}
              className={`rounded-xl border px-2 py-2 text-center text-[12px] transition ${
                panel === "more" ? "border-accent/45 bg-accent-soft text-accent" : "border-black/12 bg-white text-ink"
              }`}
              aria-expanded={panel === "more"}
              aria-label="עוד אפשרויות"
            >
              עוד
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}
