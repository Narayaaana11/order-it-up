import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MenuActionHandler from "@/components/layout/MenuActionHandler";
import AuthGuard from "@/components/layout/AuthGuard";
import { HtmlLangSync } from "@/components/layout/HtmlLangSync";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { DirectionalToaster } from "@/components/layout/DirectionalToaster";
import DesktopDragSurface from "@/components/layout/DesktopDragSurface";
import { I18nProvider } from "@/components/providers/I18nProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // Avoid font preload warnings on standalone routes that initially render without text.
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Order It Up • Modern Offline-First Restaurant POS & Operating System",
  description: "Sub-second offline POS billing with local SQLite durability, station-based kitchen order routing (KDS), table floorplans, and real-time multi-branch cloud reporting.",
  metadataBase: new URL("https://orderitup.pages.dev"),
  manifest: "/manifest.json",
  openGraph: {
    title: "Order It Up • Restaurant POS & Cloud Operating System",
    description: "Run your restaurant, not your paperwork. Sub-second offline counter billing, kitchen KDS, and multi-branch cloud sync.",
    url: "https://orderitup.pages.dev",
    siteName: "Order It Up",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Order It Up Restaurant POS",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Order It Up • Restaurant POS & Cloud Operating System",
    description: "Sub-second offline POS billing with local SQLite durability, kitchen KDS, and multi-branch cloud sync.",
    images: ["/icon-512.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Order It Up",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3248FF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* gh-513 FOUC guard: apply the last-resolved palette before first
            paint. Priority: ?theme= URL param (standalone windows opened by
            main with the current palette) → localStorage mirror → system
            matchMedia. try/catch: worst case is one light flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=new URLSearchParams(location.search).get('theme');" +
              "var t=(p==='dark'||p==='light')?p:localStorage.getItem('flo-theme-resolved');" +
              "if(t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)){" +
              'document.documentElement.classList.add(\'dark\');}}catch(e){}})();',
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>
          <DesktopDragSurface />
          <MenuActionHandler />
          <HtmlLangSync />
          <ThemeSync />
          <AuthGuard>{children}</AuthGuard>
          <DirectionalToaster />
        </I18nProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
