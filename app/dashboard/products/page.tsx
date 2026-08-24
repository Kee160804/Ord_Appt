"use client";

import { useAuth } from "@/app/contexts/auth";
import { TopBar } from "@/app/components/TopBar";
import { ProductsView } from "@/app/components/ProductsView";

export default function ProductsPage() {
  const { tenant } = useAuth();
  if (!tenant) return null;

  return (
    <>
      <TopBar title="Products" subtitle="Manage your product catalogue" />
      <ProductsView tenant={tenant} />
    </>
  );
}
