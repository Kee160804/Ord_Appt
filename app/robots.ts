import type { MetadataRoute } from "next";
import { publicAppUrl } from "@/app/lib/platform";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicAppUrl() || "https://yuhbusiness.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/dashboard/", "/api/", "/login", "/register"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
