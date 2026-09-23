import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseConfig,
  isSupabaseConfigured,
} from "@/app/lib/supabase/config";
import { updateSession } from "@/app/lib/supabase/proxy";
import {
  appRootDomain,
  getTenantSlugFromHost,
  isCustomDomainCandidate,
  normalizeHost,
} from "@/app/lib/tenant";

async function customDomainSlug(hostname: string) {
  if (!isSupabaseConfigured()) return null;
  const { url, key } = getSupabaseConfig();
  const query = new URL(`${url}/rest/v1/tenants`);
  query.searchParams.set("select", "slug");
  query.searchParams.set("custom_domain", `eq.${hostname}`);
  query.searchParams.set("custom_domain_verified_at", "not.is.null");
  query.searchParams.set("is_active", "eq.true");
  query.searchParams.set("status", "eq.ACTIVE");
  query.searchParams.set("limit", "1");

  try {
    const response = await fetch(query, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{ slug?: unknown }>;
    return typeof rows[0]?.slug === "string" ? rows[0].slug : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const storefrontSystemPath = ["/", "/robots.txt", "/sitemap.xml"].includes(
    request.nextUrl.pathname,
  );
  if (!storefrontSystemPath || sessionResponse.status >= 300) {
    return sessionResponse;
  }

  const hostname = normalizeHost(
    request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      "",
  );
  const rootDomain = appRootDomain(process.env.NEXT_PUBLIC_APP_URL);
  let slug = getTenantSlugFromHost(hostname, rootDomain);
  if (!slug && isCustomDomainCandidate(hostname, rootDomain)) {
    slug = await customDomainSlug(hostname);
  }
  if (!slug) return sessionResponse;

  const storefrontUrl = request.nextUrl.clone();
  storefrontUrl.pathname =
    request.nextUrl.pathname === "/"
      ? `/store-front/${encodeURIComponent(slug)}`
      : `/store-front/${encodeURIComponent(slug)}${request.nextUrl.pathname}`;
  const rewriteResponse = NextResponse.rewrite(storefrontUrl);
  for (const cookie of sessionResponse.cookies.getAll()) {
    rewriteResponse.cookies.set(cookie);
  }
  return rewriteResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
