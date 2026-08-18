import type { MetadataRoute } from "next";
import { priorityRoutes, products, siteUrl } from "@/lib/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-18");
  const routes = [
    ...priorityRoutes,
    ...products.map((product) => product.href),
    "/en-us/",
    "/en-eu/",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route === "/" ? "" : route}`,
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : route.startsWith("/products") ? 0.7 : 0.8,
    alternates:
      route === "/"
        ? {
            languages: {
              "en-GB": siteUrl,
              "en-US": `${siteUrl}/en-us/`,
              "en-EU": `${siteUrl}/en-eu/`,
            },
          }
        : undefined,
  }));
}
