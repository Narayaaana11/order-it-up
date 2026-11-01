import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/"],
    },
    sitemap: "https://orderitup.pages.dev/sitemap.xml",
    host: "https://orderitup.pages.dev",
  };
}
