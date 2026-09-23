import { storefrontUrl } from "@/app/lib/platform";
import { getPublicStorefront } from "@/app/services/storefrontService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const storefront = await getPublicStorefront(slug.trim().toLowerCase());
  if (!storefront)
    return new Response("User-agent: *\nDisallow: /\n", { status: 404 });

  const canonical = storefrontUrl(
    storefront.tenant.slug,
    storefront.tenant.domain,
  );

  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${canonical}/sitemap.xml\nHost: ${new URL(canonical).hostname}\n`,
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3600",
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
