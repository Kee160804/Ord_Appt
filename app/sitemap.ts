import type { MetadataRoute } from "next";
import { publicAppUrl, storefrontPath } from "@/app/lib/platform";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { listPublicStorefrontEntries } from "@/app/services/storefrontService";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicAppUrl() || "https://yuhbusiness.com";
  let storefronts: Awaited<ReturnType<typeof listPublicStorefrontEntries>> = [];
  if (isSupabaseConfigured()) {
    try {
      storefronts = await listPublicStorefrontEntries();
    } catch {
      // Keep core pages discoverable if the public database is temporarily down.
    }
  }

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2026-09-14"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date("2026-09-14"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...storefronts.map((storefront) => ({
      url: `${baseUrl}${storefrontPath(storefront.slug)}`,
      lastModified: new Date(storefront.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
