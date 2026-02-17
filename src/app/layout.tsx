import type { Metadata } from "next";
import { Caveat, Heebo, IBM_Plex_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { QuickActionsProvider } from "@/components/QuickActions";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth-server";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const canManageInvites = isAdminEmail(user?.email);

  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} ${plexMono.variable} ${caveat.variable} antialiased`}>
        <QuickActionsProvider>
          <AppShell canManageInvites={canManageInvites}>{children}</AppShell>
        </QuickActionsProvider>
      </body>
    </html>
  );
}
