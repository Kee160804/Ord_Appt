import { storefrontUrl } from "@/app/lib/platform";
import { getPublicStorefront } from "@/app/services/storefrontService";

export const dynamic = "force-dynamic";

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const storefront = await getPublicStorefront(slug.trim().toLowerCase());
  if (!storefront) return new Response("Not found", { status: 404 });

  const canonical = storefrontUrl(
    storefront.tenant.slug,
    storefront.tenant.domain,
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${xml(canonical)}</loc><lastmod>${xml(storefront.tenant.createdAt)}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`;

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=3600",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
