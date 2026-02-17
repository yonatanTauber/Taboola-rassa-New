"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { TopNav } from "@/components/TopNav";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const authPage = pathname === "/login" || pathname === "/register";

  const toneClass =
    pathname.startsWith("/patients")
      ? "page-tone-patients"
      : pathname.startsWith("/sessions")
        ? "page-tone-sessions"
        : pathname.startsWith("/guidance")
          ? "page-tone-guidance"
        : pathname.startsWith("/research")
          ? "page-tone-research"
          : pathname.startsWith("/receipts")
            ? "page-tone-finance"
            : pathname.startsWith("/settings")
              ? "page-tone-settings"
              : pathname.startsWith("/invites")
                ? "page-tone-settings"
                : "page-tone-dashboard";

  if (authPage) {
    return (
      <div className="min-h-screen overflow-x-clip p-2 md:p-4">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip p-2 md:p-4">
      <a href="#main-content" className="skip-link">דלג לתוכן</a>
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-3">
        <TopNav />
        <main id="main-content" className={`surface-card min-h-[calc(100vh-7.5rem)] overflow-x-clip rounded-2xl border border-black/14 p-3 md:p-5 ${toneClass}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
