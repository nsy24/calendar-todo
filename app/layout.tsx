import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import I18nProvider from "@/components/I18nProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SyncTask | スマートなカレンダータスク管理",
  description: "SyncTask - 第1プロジェクト・チーム共有向けのスマートなカレンダータスク管理",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "SyncTask" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${inter.className} bg-slate-50`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
