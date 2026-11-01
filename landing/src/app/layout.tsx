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
  metadataBase: new URL("https://orderitup.pages.dev"),
  title: "Order It Up | Offline-First Restaurant Operations Pilot",
  description:
    "Explore Order It Up, an early-access pilot for offline-first restaurant billing, kitchen workflows and local hardware integrations. Features and compatibility are being evaluated with pilot users.",
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
    siteName: "Order It Up",
    url: "https://orderitup.pages.dev",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Order It Up | Restaurant Operations Pilot",
    description: "An early-access pilot exploring offline-first restaurant workflows.",
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F8FAFC] text-slate-900 min-h-screen selection:bg-orange-500 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}

