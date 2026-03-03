import type { Metadata, Viewport } from "next";
import { Caveat, Heebo, IBM_Plex_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { QuickActionsProvider } from "@/components/QuickActions";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth-server";
import { canUseDailyV1 } from "@/lib/daily-feature";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Tabula Rassa",
  description: "פלטפורמת ניהול קליניקה ומחקר למטפלים",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const canManageInvites = isAdminEmail(user?.email);
  const canUseDaily = canUseDailyV1(user?.email);

  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} ${plexMono.variable} ${caveat.variable} antialiased`}>
        <QuickActionsProvider>
          <AppShell canManageInvites={canManageInvites} canUseDaily={canUseDaily}>
            {children}
          </AppShell>
        </QuickActionsProvider>
      </body>
    </html>
  );
}
