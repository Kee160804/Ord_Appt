"use client";

import { useAuth } from "@/app/contexts/auth";
import { TopBar } from "@/app/components/TopBar";
import { ProductsView } from "@/app/components/ProductsView";
import { mockTenants } from "@/app/data/mock";

export default function ProductsPage() {
  const { user } = useAuth();
  const tenant = mockTenants.find(t => t.id === user?.tenantId)!;

  return (
    <>
      <TopBar title="Products" subtitle="Manage your product catalogue" />
      <ProductsView tenant={tenant} />
    </>
  );
}