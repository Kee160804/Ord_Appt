"use client";
import { useAuth } from "../components/auth-context";
import { TopBar } from "../components/TopBar";
import { ProductsView } from "../components/ProductsView";

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
