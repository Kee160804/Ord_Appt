import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/app/data/mock";
import StorefrontClient from "@/app/components/store";   

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = getTenantBySlug(slug);
  if (!tenant) return notFound();
  return <StorefrontClient tenant={tenant} />;
}