import type { MetadataRoute } from "next";
import { publicAppUrl } from "@/app/lib/platform";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicAppUrl() || "https://yuhbusiness.com";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Indexing of front-end utility/private routes is controlled with
      // noindex metadata and X-Robots-Tag headers. Keeping those routes
      // crawlable lets Google and Bing observe the noindex directive.
      disallow: ["/api/", "/auth/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
