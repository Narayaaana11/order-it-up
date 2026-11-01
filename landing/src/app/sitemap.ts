import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://orderitup.pages.dev";
  const routes = [
    "",
    "/legal/terms/",
    "/legal/privacy/",
    "/legal/pilot-disclaimer/",
    "/legal/tax-reporting/",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "yearly",
    priority: route === "" ? 1 : 0.4,
  }));
}
