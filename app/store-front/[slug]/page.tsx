import { getTenantBySlug } from "@/app/lib/data";
import StorefrontClient from "@/app/components/store";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
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

export default async function StorePage({
  params,
  searchParams,
}: StorePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const slug = resolvedParams.slug;
  if (resolvedSearchParams.demo === "1") {
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

  if (isSupabaseConfigured()) {
    const storefront = await getPublicStorefront(slug);
    if (!storefront) notFound();

    return (
      <StorefrontClient
        tenant={storefront.tenant}
        initialCategories={storefront.categories}
        initialProducts={storefront.products}
        initialServices={storefront.services}
        initialProviders={storefront.providers}
      />
    );
  }

  const tenant = getTenantBySlug(slug);

  if (!tenant) {
    notFound();
  }

  return <StorefrontClient tenant={tenant} />;
}
