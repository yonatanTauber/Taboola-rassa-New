"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "דשבורד", icon: "⌂" },
  { href: "/patients", label: "מטופלים", icon: "◉" },
  { href: "/tasks", label: "משימות", icon: "✓" },
  { href: "/sessions", label: "פגישות", icon: "◷" },
  { href: "/guidance", label: "הדרכות", icon: "✎" },
  { href: "/inquiries", label: "פניות", icon: "◎" },
  { href: "/receipts", label: "כספים", icon: "₪" },
  { href: "/research", label: "מחקר", icon: "✦" },
  { href: "/invites", label: "הזמנות", icon: "✉" },
  { href: "/settings", label: "הגדרות", icon: "⚙" },
];

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto px-1 md:flex-col md:overflow-visible">
      {ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`group flex items-center rounded-xl border px-2 py-2 text-sm transition ${
              collapsed ? "justify-center md:min-h-10 md:px-1" : "gap-2"
            } ${
              active
                ? "border-accent/30 bg-accent-soft/80 text-accent"
                : "border-transparent text-muted hover:border-black/8 hover:bg-white"
            }`}
          >
            <span className={`text-xs ${active ? "text-accent" : "text-muted/90 group-hover:text-ink"}`}>{item.icon}</span>
            {!collapsed ? <span className="whitespace-nowrap">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
