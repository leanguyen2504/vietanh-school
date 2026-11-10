import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cổng quản trị nội bộ — Trường Tiểu học & THCS Việt Anh",
  description: "Hệ thống quản trị nội bộ Trường Việt Anh",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${font.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
