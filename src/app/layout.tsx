import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "房仲 AI 預約系統",
  description: "房仲電子名片、線上預約與預約管理後台的跨平台教學專案",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
