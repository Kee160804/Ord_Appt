import { getTenantBySlug } from "@/app/data/mock";
import StorefrontClient from "@/app/components/store";
import { notFound } from "next/navigation";

interface StorePageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

export default async function StorePage({ params }: StorePageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const tenant = getTenantBySlug(slug);

  if (!tenant) {
    notFound();
  }

  return <StorefrontClient tenant={tenant} />;
}
