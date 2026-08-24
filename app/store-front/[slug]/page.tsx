import { getTenantBySlug } from "@/app/lib/data";
import StorefrontClient from "@/app/components/store";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/app/lib/supabase/config";
import { getPublicStorefront } from "@/app/services/storefrontService";

interface StorePageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

export default async function StorePage({ params }: StorePageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  if (isSupabaseConfigured()) {
    const storefront = await getPublicStorefront(slug);
    if (!storefront) notFound();

    return (
      <StorefrontClient
        tenant={storefront.tenant}
        initialCategories={storefront.categories}
        initialProducts={storefront.products}
        initialServices={storefront.services}
      />
    );
  }

  const tenant = getTenantBySlug(slug);

  if (!tenant) {
    notFound();
  }

  return <StorefrontClient tenant={tenant} />;
}
