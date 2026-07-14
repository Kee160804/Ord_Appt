"use client";

import { useAuth } from "@/app/contexts/auth";
import { TopBar } from "@/app/components/TopBar";
import { ProductsView } from "@/app/components/ProductsView";
import { getTenantById } from "@/app/lib/data";

export default function ProductsPage() {
  const { user } = useAuth();
  const tenant = getTenantById(user?.tenantId ?? "");
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Products" subtitle="Manage your product catalogue" />
      <ProductsView tenant={tenant} />
    </>
  );
}