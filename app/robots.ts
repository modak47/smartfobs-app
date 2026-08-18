import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/dashboard/", "/bank/", "/smartfobs/", "/api/"],
    },
    sitemap: "https://smartfobs.co.uk/sitemap.xml",
  };
}
