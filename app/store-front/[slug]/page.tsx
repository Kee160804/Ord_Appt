import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StorefrontClient from "@/app/components/store";
import { getTenantBySlug } from "@/app/lib/data";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { storefrontUrl } from "@/app/lib/platform";
import { getPublicStorefront } from "@/app/services/storefrontService";
import {
  getCategoriesByTenant,
  getProductsByTenant,
  getServicesByTenant,
  getTenantBySlug as getDemoTenantBySlug,
} from "@/app/data/mock";

interface StorePageProps {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?: Promise<{ demo?: string }> | { demo?: string };
}

const SITE_NAME = "YuhBusiness";
const DEFAULT_DESCRIPTION =
  "Browse products, services, and appointment options on YuhBusiness.";

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function isDemoRequest(demo: string | undefined): boolean {
  return demo === "1";
}

function storefrontDescription(
  name: string,
  description: string | null | undefined,
): string {
  const normalized = description?.trim();
  return normalized || `Visit ${name} on ${SITE_NAME}.`;
}

function canonicalStorefrontUrl(slug: string, customDomain?: string) {
  return storefrontUrl(slug, customDomain);
}

function storefrontStructuredData(
  storefront: NonNullable<Awaited<ReturnType<typeof getPublicStorefront>>>,
) {
  const { tenant } = storefront;
  const url = canonicalStorefrontUrl(tenant.slug, tenant.domain);
  const sameAs = Object.values(tenant.socialLinks).filter(
    (value): value is string =>
      typeof value === "string" && /^https?:\/\//i.test(value),
  );
  const openingHoursSpecification = tenant.businessHours
    .filter((hours) => !hours.closed && hours.open && hours.close)
    .map((hours) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${hours.day}`,
      opens: hours.open,
      closes: hours.close,
    }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${url}/#business`,
        name: tenant.name,
        url,
        description: storefrontDescription(tenant.name, tenant.description),
        image: tenant.coverImage || tenant.logoImage || undefined,
        logo: tenant.logoImage || undefined,
        telephone: tenant.phone || undefined,
        email: tenant.email || undefined,
        address:
          tenant.address || tenant.city
            ? {
                "@type": "PostalAddress",
                streetAddress: tenant.address || undefined,
                addressLocality: tenant.city || undefined,
                addressCountry: "BZ",
              }
            : undefined,
        openingHoursSpecification:
          openingHoursSpecification.length > 0
            ? openingHoursSpecification
            : undefined,
        sameAs: sameAs.length > 0 ? sameAs : undefined,
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: tenant.name,
        url,
        publisher: { "@id": `${url}/#business` },
        inLanguage: "en-BZ",
      },
    ],
  };
}

/**
 * Generate storefront metadata on the server.
 *
 * We intentionally resolve metadata from the same public storefront source as
 * the page. This prevents private dashboard data from being used to build
 * public SEO metadata.
 *
 * Demo storefronts are explicitly marked noindex/nofollow so preview/sample
 * pages do not compete with real tenant storefronts in search engines.
 */
export async function generateMetadata({
  params,
  searchParams,
}: StorePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const slug = normalizeSlug(resolvedParams.slug);

  if (!slug) {
    return {
      title: `Storefront | ${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
      robots: { index: false, follow: false },
    };
  }

  if (isDemoRequest(resolvedSearchParams.demo)) {
    const demoTenant = getDemoTenantBySlug(slug);

    if (!demoTenant) {
      return {
        title: `Storefront | ${SITE_NAME}`,
        description: DEFAULT_DESCRIPTION,
        robots: { index: false, follow: false },
      };
    }

    const description = storefrontDescription(
      demoTenant.name,
      demoTenant.description,
    );

    return {
      title: `${demoTenant.name} | ${SITE_NAME}`,
      description,
      robots: { index: false, follow: false },
    };
  }

  if (isSupabaseConfigured()) {
    try {
      const storefront = await getPublicStorefront(slug);

      if (!storefront) {
        return {
          title: `Storefront | ${SITE_NAME}`,
          description: DEFAULT_DESCRIPTION,
          robots: { index: false, follow: false },
        };
      }

      const { tenant } = storefront;
      const description = storefrontDescription(
        tenant.name,
        tenant.description,
      );
      const canonical = canonicalStorefrontUrl(tenant.slug, tenant.domain);

      return {
        title: `${tenant.name} | ${SITE_NAME}`,
        description,
        alternates: { canonical },
        openGraph: {
          title: tenant.name,
          description,
          type: "website",
          url: canonical,
          images: tenant.coverImage ? [{ url: tenant.coverImage }] : undefined,
        },
        twitter: {
          card: tenant.coverImage ? "summary_large_image" : "summary",
          title: tenant.name,
          description,
          images: tenant.coverImage ? [tenant.coverImage] : undefined,
        },
      };
    } catch {
      /**
       * Metadata generation should not replace the page's real error behavior.
       * The page load below remains authoritative and will surface/handle the
       * storefront failure normally.
       */
      return {
        title: `Storefront | ${SITE_NAME}`,
        description: DEFAULT_DESCRIPTION,
      };
    }
  }

  const tenant = getTenantBySlug(slug);

  if (!tenant) {
    return {
      title: `Storefront | ${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
      robots: { index: false, follow: false },
    };
  }

  const description = storefrontDescription(tenant.name, tenant.description);
  const canonical = canonicalStorefrontUrl(tenant.slug, tenant.domain);

  return {
    title: `${tenant.name} | ${SITE_NAME}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: tenant.name,
      description,
      type: "website",
      url: canonical,
      images: tenant.coverImage ? [{ url: tenant.coverImage }] : undefined,
    },
    twitter: {
      card: tenant.coverImage ? "summary_large_image" : "summary",
      title: tenant.name,
      description,
      images: tenant.coverImage ? [tenant.coverImage] : undefined,
    },
  };
}

export default async function StorePage({
  params,
  searchParams,
}: StorePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const slug = normalizeSlug(resolvedParams.slug);

  if (!slug) notFound();

  /**
   * Demo mode is deliberately isolated from the production storefront loader.
   * It is view-only and never receives production providers or mutation data.
   */
  if (isDemoRequest(resolvedSearchParams.demo)) {
    const demoTenant = getDemoTenantBySlug(slug);
    if (!demoTenant) notFound();

    const dayOrder = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const previewTenant = {
      ...demoTenant,
      businessHours: [...demoTenant.businessHours].sort(
        (a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day),
      ),
    };

    return (
      <StorefrontClient
        tenant={previewTenant}
        initialCategories={getCategoriesByTenant(demoTenant.id)}
        initialProducts={getProductsByTenant(demoTenant.id).filter(
          (product) => product.isActive,
        )}
        initialServices={getServicesByTenant(demoTenant.id).filter(
          (service) => service.isActive,
        )}
        viewOnly
      />
    );
  }

  /**
   * Production storefronts use the public/anonymous Supabase loader. That
   * loader applies tenant scoping and only resolves active tenants.
   */
  if (isSupabaseConfigured()) {
    const storefront = await getPublicStorefront(slug);
    if (!storefront) notFound();
    const structuredData = storefrontStructuredData(storefront);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
          }}
        />
        <StorefrontClient
          tenant={storefront.tenant}
          initialCategories={storefront.categories}
          initialProducts={storefront.products}
          initialServices={storefront.services}
          initialProviders={storefront.providers}
          initialReviews={storefront.reviews}
          initialPromotions={storefront.promotions}
        />
      </>
    );
  }

  /**
   * Local fallback keeps development usable when Supabase is intentionally not
   * configured. Production should normally take the Supabase branch above.
   */
  const tenant = getTenantBySlug(slug);

  if (!tenant) {
    notFound();
  }

  return <StorefrontClient tenant={tenant} />;
}
