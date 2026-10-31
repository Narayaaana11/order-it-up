import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#F8FAFC",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Order It Up — The Offline-First Operating System for Modern Restaurants",
  description:
    "Run lightning-fast counter billing with zero cloud dependency, real-time kitchen displays (KDS), and direct ESC/POS thermal printing. Powered by embedded SQLite reliability.",
  keywords: [
    "Restaurant POS",
    "Offline POS",
    "Kitchen Display System",
    "KDS",
    "Thermal Printer ESC/POS",
    "Offline-First",
    "Restaurant Billing Software",
  ],
  authors: [{ name: "IndentDev" }],
  openGraph: {
    title: "Order It Up — Offline-First Restaurant POS",
    description: "Sub-second billing, local KDS, and direct thermal printing without internet dependency.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F8FAFC] text-slate-900 min-h-screen selection:bg-orange-500 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}

