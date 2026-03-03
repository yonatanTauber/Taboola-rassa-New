"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { MobileBottomDock } from "@/components/MobileBottomDock";
import { TopNav } from "@/components/TopNav";

export function AppShell({
  children,
  canManageInvites = false,
  canUseDaily = false,
}: {
  children: ReactNode;
  canManageInvites?: boolean;
  canUseDaily?: boolean;
}) {
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

  const mainClass = authPage
    ? "mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-lg items-center"
    : `surface-card min-h-[calc(100vh-7.5rem)] overflow-x-clip rounded-2xl border border-black/14 p-3 pb-[calc(env(safe-area-inset-bottom)+4.8rem)] md:p-5 md:pb-5 ${toneClass}`;

  return (
    <div className="min-h-screen overflow-x-clip p-2 md:p-4" suppressHydrationWarning>
      <a href="#main-content" className={`skip-link${authPage ? " sr-only" : ""}`}>דלג לתוכן</a>
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-3">
        <div className={authPage ? "hidden" : ""}>
          <TopNav canManageInvites={canManageInvites} canUseDaily={canUseDaily} />
        </div>
        <main
          id="main-content"
          className={mainClass}
          suppressHydrationWarning
        >
          {children}
        </main>
        <div className={authPage ? "hidden" : ""}>
          <MobileBottomDock canManageInvites={canManageInvites} canUseDaily={canUseDaily} />
        </div>
      </div>
    </div>
  );
}
