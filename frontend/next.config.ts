import type { NextConfig } from "next";
import path from "node:path";
/**
 * NEXT_BUILD_MODE=desktop  →  static export for Electron (Order It Up Desktop)
 * NEXT_BUILD_MODE=web      →  static export for Cloudflare Pages (Order It Up Cloud Dashboard)
 * NEXT_BUILD_MODE unset    →  standard Next.js server mode
 */
const isExport = process.env.NEXT_BUILD_MODE === "desktop" || process.env.NEXT_BUILD_MODE === "web" || process.env.NEXT_BUILD_MODE === "export";

const nextConfig: NextConfig = {
  // Static export: required for Electron and Cloudflare Pages static hosting
  output: isExport ? "export" : undefined,

  // Trailing slashes make static paths predictable: /pos → /pos/index.html
  trailingSlash: isExport,

  // next/image optimisation requires a running server; disable for static export.
  images: {
    unoptimized: isExport,
  },

  // Silence the "multiple lockfiles / inferred workspace root" warning.
  // Allow imports from /main (countries derivation shared with backend) via alias;
  // root must encompass both frontend/ and main/, so it points at the repo root.
  turbopack: {
    root: path.resolve(process.cwd(), '..'),
    resolveAlias: {
      '@countries': '../main/countries.ts',
    },
  },
};

export default nextConfig;
